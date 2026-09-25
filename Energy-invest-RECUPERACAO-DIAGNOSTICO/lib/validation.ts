import { z } from "zod";
export function validPhone(value: string) {
  const digits = value.replace(/[\s()+-]/g, "");
  return /^(?:55)?[1-9]{2}[2-9]\d{7,8}$/.test(digits);
}
export const passwordSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres.")
  .max(128)
  .regex(/[A-Za-z]/, "Inclua uma letra.")
  .regex(/[0-9]/, "Inclua um número.");
export const authSchema = z
  .object({
    action: z.enum(["login", "signup", "recover", "reset"]),
    identifier: z.string().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    password: z.string().optional(),
    confirm: z.string().optional(),
    inviteCode: z.string().max(50).optional(),
    terms: z.boolean().optional(),
  })
  .superRefine((d, c) => {
    const error = (path: string, message: string) =>
      c.addIssue({ code: "custom", path: [path], message });
    if (d.action === "login") {
      if (
        !d.identifier ||
        (!z.email().safeParse(d.identifier).success &&
          !validPhone(d.identifier))
      )
        error("identifier", "Informe um e-mail ou telefone válido.");
      if (!d.password) error("password", "Informe sua senha.");
    }
    if (d.action === "signup" || d.action === "recover") {
      if (!z.email().safeParse(d.email).success)
        error("email", "Informe um e-mail válido.");
    }
    if (d.action === "signup") {
      if (!d.name || d.name.trim().length < 3)
        error("name", "Informe seu nome completo.");
      if (!d.phone || !validPhone(d.phone))
        error("phone", "Informe um telefone válido.");
      if (!d.terms) error("terms", "Aceite os termos para continuar.");
    }
    if (d.action === "signup" || d.action === "reset") {
      const pass = passwordSchema.safeParse(d.password);
      if (!pass.success) error("password", pass.error.issues[0].message);
      if (d.password !== d.confirm)
        error("confirm", "As senhas não coincidem.");
    }
  });
export type AuthInput = z.infer<typeof authSchema>;
export const projectSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(3).max(120),
    description: z.string().min(20).max(3000),
    image_url: z
      .string()
      .refine(
        (s) => s.startsWith("/solar-") || /^https:\/\//.test(s),
        "Use um endereço HTTPS de imagem.",
      ),
    city: z.string().min(2),
    state: z.enum([
      "SP",
      "RJ",
      "MG",
      "BA",
      "CE",
      "PE",
      "GO",
      "PR",
      "RS",
      "Europa",
      "EUA",
      "China",
    ]),
    investment_amount: z
      .number()
      .min(50, "O investimento mínimo por cota é R$ 50.")
      .max(1000000),
    daily_projected_return: z.number().nonnegative().max(1000000),
    return_multiplier: z.number().min(1).max(5),
    duration_days: z.number().int().min(1).max(365),
    available_units: z.number().int().nonnegative().max(1000000),
    max_units_per_user: z.number().int().min(1).max(1000),
    start_date: z.string().min(10),
    end_date: z.string().min(10),
    status: z.enum(["available", "active", "finished", "sold_out", "paused"]),
  })
  .refine((d) => new Date(d.end_date) > new Date(d.start_date), {
    path: ["end_date"],
    message: "Encerramento deve ser posterior ao início.",
  });
