import { parse } from "csv-parse/sync";

export function csvEscape(value = "") {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function routineToCsv(routine) {
  const header = "title,notes,exercise_name,sets,reps,exercise_notes,order";
  const rows = (routine.exercises?.length ? routine.exercises : [null]).map((ex, idx) => {
    const cells = [
      csvEscape(routine.title),
      csvEscape(routine.notes ?? ""),
      csvEscape(ex?.name ?? ""),
      csvEscape(ex?.sets ?? ""),
      csvEscape(ex?.reps ?? ""),
      csvEscape(ex?.notes ?? ""),
      ex?.order ?? idx
    ];
    return cells.join(",");
  });
  return [header, ...rows].join("\n");
}

export function csvToRoutine(csvText) {
  if (!csvText || !csvText.trim()) {
    const e = new Error("CSV vacío"); e.statusCode = 400; throw e;
  }

  // Soporta BOM y CRLF
  const clean = csvText.replace(/^\uFEFF/, "");

  let records;
  try {
    records = parse(clean, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    const e = new Error("No se pudo parsear el CSV"); e.statusCode = 400; throw e;
  }

  if (!Array.isArray(records) || records.length === 0) {
    const e = new Error("CSV sin filas"); e.statusCode = 400; throw e;
  }

  // Validar cabecera mínima
  const cols = Object.keys(records[0] || {});
  const expected = ["title","notes","exercise_name","sets","reps","exercise_notes","order"];
  const missing = expected.filter(k => !cols.includes(k));
  if (missing.length) {
    const e = new Error(`Faltan columnas en CSV: ${missing.join(", ")}`); e.statusCode = 400; throw e;
  }

  const first = records[0];
  const title = (first.title || "").trim();
  if (!title) { const e = new Error("Falta 'title' en la primera fila"); e.statusCode = 400; throw e; }

  const notes = (first.notes || "").trim() || undefined;

  // Asegurar coherencia de título entre filas
  const badTitle = records.find(r => (r.title || "").trim() !== title);
  if (badTitle) {
    const e = new Error("Todas las filas deben tener el mismo 'title'"); e.statusCode = 400; throw e;
  }

  const exercises = records.map((r, idx) => ({
    name: (r.exercise_name || "").trim(),
    sets: (r.sets || "").trim() || undefined,
    reps: (r.reps || "").trim() || undefined,
    notes: (r.exercise_notes || "").trim() || undefined,
    order: r.order !== undefined && r.order !== "" ? Number(r.order) : idx
  })).filter(e => e.name.length > 0);

  return { title, notes, exercises };
}
