import os
import tempfile
from statistics import median

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR


app = FastAPI(title="MGP OCR Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "mgp-ocr-service",
        "engine": "paddleocr",
    }


def get_box_from_result(rec_box=None, rec_poly=None):
    if rec_box is not None:
        try:
            if len(rec_box) == 4:
                x1, y1, x2, y2 = rec_box
                return [float(x1), float(y1), float(x2), float(y2)]
        except Exception:
            pass

    if rec_poly is not None:
        try:
            points = rec_poly.tolist() if hasattr(rec_poly, "tolist") else rec_poly

            xs = [float(point[0]) for point in points]
            ys = [float(point[1]) for point in points]

            return [min(xs), min(ys), max(xs), max(ys)]
        except Exception:
            pass

    return None


def sort_items_by_visual_rows(items):
    items_with_box = [item for item in items if item.get("box")]
    items_without_box = [item for item in items if not item.get("box")]

    if not items_with_box:
        return items

    for item in items_with_box:
        x1, y1, x2, y2 = item["box"]
        item["centerX"] = (x1 + x2) / 2
        item["centerY"] = (y1 + y2) / 2
        item["height"] = max(y2 - y1, 1)

    heights = [item["height"] for item in items_with_box]
    row_threshold = max(14, median(heights) * 0.85)

    sorted_items = sorted(items_with_box, key=lambda item: item["centerY"])

    rows = []

    for item in sorted_items:
        inserted = False

        for row in rows:
            if abs(row["centerY"] - item["centerY"]) <= row_threshold:
                row["items"].append(item)

                row["centerY"] = sum(
                    row_item["centerY"] for row_item in row["items"]
                ) / len(row["items"])

                inserted = True
                break

        if not inserted:
            rows.append(
                {
                    "centerY": item["centerY"],
                    "items": [item],
                }
            )

    visual_lines = []

    for row in sorted(rows, key=lambda row: row["centerY"]):
        row_items = sorted(row["items"], key=lambda item: item["centerX"])
        visual_line = " ".join(item["text"] for item in row_items).strip()

        if visual_line:
            visual_lines.append(visual_line)

    for item in items_without_box:
        text = item.get("text", "").strip()

        if text:
            visual_lines.append(text)

    return visual_lines


@app.post("/ocr/routine")
async def read_routine_image(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1] or ".jpg"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = temp_file.name
        content = await file.read()
        temp_file.write(content)

    try:
        result = ocr.predict(temp_path)

        detected_items = []

        for page in result:
            data = None

            if hasattr(page, "json"):
                data = page.json

                if callable(data):
                    data = page.json()

            if not isinstance(data, dict):
                continue

            res = data.get("res", data)

            rec_texts = res.get("rec_texts", [])
            rec_scores = res.get("rec_scores", [])
            rec_boxes = res.get("rec_boxes", [])
            rec_polys = res.get("rec_polys", [])

            for index, text in enumerate(rec_texts):
                clean_text = str(text or "").strip()

                if not clean_text:
                    continue

                score = None

                if index < len(rec_scores):
                    try:
                        score = float(rec_scores[index])
                    except Exception:
                        score = None

                rec_box = rec_boxes[index] if index < len(rec_boxes) else None
                rec_poly = rec_polys[index] if index < len(rec_polys) else None

                box = get_box_from_result(rec_box=rec_box, rec_poly=rec_poly)

                detected_items.append(
                    {
                        "text": clean_text,
                        "score": score,
                        "box": box,
                    }
                )

        visual_lines = sort_items_by_visual_rows(detected_items)
        full_text = "\n".join(visual_lines)

        return {
            "success": True,
            "text": full_text,
            "lineCount": len(visual_lines),
            "lines": detected_items,
            "visualLines": visual_lines,
        }

    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass