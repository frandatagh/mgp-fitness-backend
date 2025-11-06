import { ZodError } from "zod";

export function validate(schema, pick = "body") {
  return (req, _res, next) => {
    try {
      const parsed = schema.parse(req[pick]);
      // opcional: reemplaza por lo parseado/sanitizado
      req[pick] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map(i => ({ path: i.path.join("."), message: i.message }));
        const e = new Error("Validation failed");
        e.statusCode = 400;
        e.details = issues;
        return next(e);
      }
      next(err);
    }
  };
}