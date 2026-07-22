import os
import tempfile

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR


# Creamos la aplicación FastAPI.
# Esto es parecido a cuando en Express hacés:
# const app = express()
app = FastAPI(title="MGP OCR Service")


# Permitimos que otros servicios puedan llamar a este microservicio.
# En desarrollo lo dejamos abierto con "*".
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Creamos una instancia de PaddleOCR.
# Esto carga el motor OCR una sola vez cuando arranca el servidor.
# Después cada imagen usa esta misma instancia.
ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)


# Ruta simple para comprobar que el servicio está vivo.
# Cuando entres a http://localhost:8001/health
# debería responder {"ok": true, ...}
@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "mgp-ocr-service",
        "engine": "paddleocr",
    }


# Esta es la ruta principal.
# Recibe una imagen por FormData con el nombre "file".
# Ejemplo futuro desde Node:
# formData.append("file", imagen)
@app.post("/ocr/routine")
async def read_routine_image(file: UploadFile = File(...)):
    # Sacamos la extensión del archivo.
    # Si no tiene extensión, usamos .jpg por defecto.
    suffix = os.path.splitext(file.filename or "")[1] or ".jpg"

    # Creamos un archivo temporal.
    # PaddleOCR necesita leer una imagen desde una ruta física.
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = temp_file.name

        # Leemos el contenido binario de la imagen subida.
        content = await file.read()

        # Guardamos la imagen temporalmente en disco.
        temp_file.write(content)

    try:
        # Ejecutamos PaddleOCR sobre la imagen.
        # Esto devuelve una lista de resultados.
        result = ocr.predict(temp_path)

        texts = []
        lines = []

        # Recorremos cada resultado detectado.
        for page in result:
            data = None

            # PaddleOCR puede exponer los datos en formato json.
            # Esta parte intenta obtenerlos de forma segura.
            if hasattr(page, "json"):
                data = page.json

                if callable(data):
                    data = page.json()

            # Si no se pudo obtener nada, seguimos con la próxima página.
            if not isinstance(data, dict):
                continue

            # En muchas versiones de PaddleOCR, los textos vienen dentro de "res".
            res = data.get("res", data)

            rec_texts = res.get("rec_texts", [])
            rec_scores = res.get("rec_scores", [])

            for index, text in enumerate(rec_texts):
                if not text:
                    continue

                clean_text = str(text).strip()

                if not clean_text:
                    continue

                score = None

                if index < len(rec_scores):
                    try:
                        score = float(rec_scores[index])
                    except Exception:
                        score = None

                texts.append(clean_text)

                lines.append(
                    {
                        "text": clean_text,
                        "score": score,
                    }
                )

        full_text = "\n".join(texts)

        return {
            "success": True,
            "text": full_text,
            "lineCount": len(lines),
            "lines": lines,
        }

    finally:
        # Borramos la imagen temporal para no llenar el disco.
        try:
            os.remove(temp_path)
        except Exception:
            pass