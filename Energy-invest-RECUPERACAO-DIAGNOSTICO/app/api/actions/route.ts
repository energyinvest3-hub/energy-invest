import { cookies } from "next/headers";
import { z } from "zod";

import { validPhone } from "@/lib/validation";
import { demoData, isDemo } from "@/lib/demo";
import { supabaseServer } from "@/lib/supabase/server";
import {
  clientIp,
  rateLimit,
  RateLimitError,
} from "@/lib/security";
import { paymentGateway } from "@/lib/payments/mock";
import { demoGoalDefinitions, goalProgress } from "@/lib/goals";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/lib/supabase/config";
import {
  isWithdrawalWindow,
  withdrawalWindowLabel,
} from "@/lib/withdrawal-window";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("purchase"),
    projectId: z.string().min(1),
    quantity: z.number().int().min(1).max(100),
    accepted: z.literal(true),
  }),

  z.object({
    action: z.literal("deposit"),
    amount: z.number().min(1).max(100000),
    cpf: z.string().min(11).max(20),
  }),

  z.object({
    action: z.literal("depositStatus"),
    id: z.string().uuid(),
  }),

  z.object({
    action: z.literal("withdrawal"),
    amount: z.number().min(1).max(100000),
    pixKey: z.string().min(5).max(200),
    pixKeyType: z.enum([
      "cpf",
      "email",
      "phone",
      "random",
    ]),
  }),

  z.object({
    action: z.literal("read"),
    id: z.string(),
  }),

  z.object({
    action: z.literal("task"),
    taskKey: z.enum([
      "security_review",
      "projection_guide",
    ]),
  }),

  z.object({
    action: z.literal("claimReward"),
    goalKey: z.enum([
      "panels_5",
      "panels_10",
      "holding_10_days",
      "holding_30_days",
    ]),
  }),

  z.object({
    action: z.literal("profile"),
    name: z.string().min(3).max(100),
    phone: z
      .string()
      .refine(
        validPhone,
        "Informe um telefone válido.",
      ),
  }),

  z.object({
    action: z.literal("logout"),
  }),
]);

export async function POST(
  request: Request,
) {
  try {
    /*
     * ============================
     * ORIGIN / CSRF BÁSICO
     * ============================
     */
    const origin =
      request.headers.get("origin");

    if (
      !origin ||
      new URL(origin).host !==
        request.headers.get("host")
    ) {
      return Response.json(
        {
          error: "Origem inválida.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ============================
     * VALIDAÇÃO DO BODY
     * ============================
     */
    const input = schema.parse(
      await request.json(),
    );

    /*
     * ============================
     * IDENTIFICAÇÃO DE IP
     * ============================
     */
    const ip = clientIp(request);

    /*
     * Limite geral por IP antes
     * mesmo da autenticação.
     */
    await rateLimit(
      `preauth-ip:${ip}`,
      {
        limit: 120,
        windowSeconds: 60,
      },
    );

    /*
     * ============================
     * KILL SWITCH DE PIX
     * ============================
     *
     * Enquanto o ataque estiver
     * acontecendo mantenha:
     *
     * DEPOSITS_DISABLED=true
     *
     * na Vercel.
     */
    if (
      (input.action === "deposit" ||
        input.action ===
          "depositStatus") &&
      process.env
        .DEPOSITS_DISABLED === "true"
    ) {
      return Response.json(
        {
          error:
            "Depósitos temporariamente indisponíveis. Tente novamente mais tarde.",
        },
        {
          status: 503,
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    /*
     * ============================
     * DEMO
     * ============================
     */
    const jar = await cookies();

    let id =
      jar.get("energy_demo")?.value;

    if (isDemo()) {
      if (!id) {
        id = crypto.randomUUID();

        jar.set(
          "energy_demo",
          id,
          {
            httpOnly: true,
            sameSite: "lax",
            secure:
              new URL(request.url)
                .protocol ===
              "https:",
            path: "/",
            maxAge: 86400,
          },
        );
      }

      await rateLimit(
        `demo:${id}`,
        {
          limit: 30,
          windowSeconds: 60,
        },
      );

      const data = demoData(id);

      if (
        input.action === "purchase"
      ) {
        const p =
          data.projects.find(
            (p) =>
              p.id ===
              input.projectId,
          );

        if (
          !p ||
          ![
            "available",
            "active",
          ].includes(p.status)
        ) {
          throw new Error(
            "Projeto indisponível.",
          );
        }

        const held =
          data.holdings
            .filter(
              (h) =>
                h.projectId ===
                p.id,
            )
            .reduce(
              (s, h) =>
                s + h.quantity,
              0,
            );

        if (
          input.quantity >
            p.availableUnits ||
          input.quantity + held >
            p.maxUnitsPerUser
        ) {
          throw new Error(
            "Quantidade acima do limite disponível.",
          );
        }

        const now =
          new Date().toISOString();

        const total =
          (Math.round(
            p.investmentAmount *
              100,
          ) *
            input.quantity) /
          100;

        const holding = {
          id: crypto.randomUUID(),
          projectId: p.id,
          quantity:
            input.quantity,
          amountInvested: total,
          totalReceived: 0,
          startedAt:
            p.startDate,
          endsAt: p.endDate,
          status:
            "active" as const,
          createdAt: now,
          elapsedDays: 0,
        };

        data.holdings.unshift(
          holding,
        );

        data.credits ??= [];

        for (
          let day = 1;
          day <= p.durationDays;
          day++
        ) {
          data.credits.push({
            id:
              crypto.randomUUID(),
            userProjectId:
              holding.id,

            amount:
              (Math.round(
                p.dailyProjectedReturn *
                  100,
              ) *
                input.quantity) /
              100,

            creditNumber: day,

            scheduledAt:
              new Date(
                new Date(
                  p.startDate,
                ).getTime() +
                  (day - 1) *
                    86400000,
              ).toISOString(),

            creditedAt: null,
            status: "pending",
          });
        }

        p.availableUnits -=
          input.quantity;

        data.transactions.unshift({
          id:
            crypto.randomUUID(),
          title: `Participação simulada · ${p.name}`,
          type: "purchase",
          amount: -total,
          status: "completed",
          createdAt: now,
        });

        data.notifications.unshift({
          id:
            crypto.randomUUID(),
          title:
            "Participação simulada registrada",
          message: `${p.name} já está em Meus painéis. Sua carteira real não foi alterada.`,
          read: false,
          createdAt: now,
        });

        return Response.json({
          message:
            "Simulação adicionada aos seus painéis.",
          id: holding.id,
        });
      }

      if (
        input.action === "deposit"
      ) {
        /*
         * Proteção também no
         * ambiente demo.
         */
        await rateLimit(
          `demo-pix:${id}`,
          {
            limit: 2,
            windowSeconds: 60,
          },
        );

        const deposit =
          await paymentGateway.createDeposit(
            input.amount,
          );

        data.transactions.unshift({
          id: deposit.id,
          title:
            "Depósito simulado",
          type: "deposit",
          amount: input.amount,
          status: "pending",
          createdAt:
            new Date().toISOString(),
        });

        return Response.json({
          message:
            "Solicitação simulada criada. Nenhum pagamento ou saldo foi gerado.",
          deposit,
        });
      }

      if (
        input.action ===
        "depositStatus"
      ) {
        const tx =
          data.transactions.find(
            (t) =>
              t.id === input.id,
          );

        return Response.json({
          deposit: {
            id: input.id,
            status:
              tx?.status ??
              "pending",
          },
        });
      }

      if (
        input.action ===
        "withdrawal"
      ) {
        if (
          input.amount >
          data.wallet.balance
        ) {
          throw new Error(
            "Saldo insuficiente.",
          );
        }

        if (
          !isWithdrawalWindow()
        ) {
          throw new Error(
            `Saques disponíveis ${withdrawalWindowLabel}, no horário de Brasília.`,
          );
        }

        return Response.json({
          withdrawal:
            await paymentGateway.requestWithdrawal(
              input,
            ),

          message:
            "Solicitação simulada registrada.",
        });
      }

      if (
        input.action === "read"
      ) {
        data.notifications.forEach(
          (n) => {
            if (
              input.id === "all" ||
              n.id === input.id
            ) {
              n.read = true;
            }
          },
        );
      }

      if (
        input.action === "profile"
      ) {
        data.profile.name =
          input.name;

        data.profile.phone =
          input.phone;
      }

      if (
        input.action === "task"
      ) {
        if (
          !data.completedTasks.includes(
            input.taskKey,
          )
        ) {
          data.completedTasks.push(
            input.taskKey,
          );
        }

        return Response.json({
          message:
            "Meta concluída.",
        });
      }

      if (
        input.action ===
        "claimReward"
      ) {
        const goal =
          demoGoalDefinitions.find(
            (definition) =>
              definition.key ===
              input.goalKey,
          );

        if (
          !goal ||
          !goalProgress(
            goal,
            data.holdings,
          ).achieved
        ) {
          throw new Error(
            "Essa meta ainda não foi atingida.",
          );
        }

        const existing =
          data.rewards.find(
            (reward) =>
              reward.goalKey ===
              input.goalKey,
          );

        if (existing) {
          return Response.json({
            message:
              "O bônus desta meta já foi solicitado.",
            reward: existing,
          });
        }

        const reward = {
          id:
            crypto.randomUUID(),
          goalKey: goal.key,
          bonusAmount:
            goal.bonusAmount,
          status:
            "pending" as const,
          claimedAt:
            new Date().toISOString(),
          creditedAt: null,
        };

        data.rewards.unshift(
          reward,
        );

        return Response.json({
          message:
            "Bônus demonstrativo enviado para validação.",
          reward,
        });
      }

      if (
        input.action === "logout"
      ) {
        jar.delete("energy_demo");
      }

      return Response.json({
        message:
          "Atualizado com sucesso.",
      });
    }

    /*
     * ============================
     * SUPABASE
     * ============================
     */
    const db =
      await supabaseServer();

    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return Response.json(
        {
          error:
            "Entre na sua conta.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * ============================
     * PAGAMENTOS MIGRADOS
     * ============================
     *
     * O frontend atual usa:
     * /api/payments/pushinpay/deposit
     * /api/payments/pushinpay/status
     *
     * Este bloqueio impede versões antigas do frontend de
     * executarem o fluxo legado SyncPay em produção.
     */
    if (
      ["deposit", "depositStatus"].includes(String(input.action))
    ) {
      return Response.json(
        {
          error:
            "O fluxo de pagamento foi atualizado. Recarregue a página e tente novamente.",
        },
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    /*
     * ============================
     * RATE LIMIT GERAL
     * ============================
     */
    await rateLimit(
      `api-user:${user.id}`,
      {
        limit: 60,
        windowSeconds: 60,
      },
    );

    await rateLimit(
      `api-ip:${ip}`,
      {
        limit: 120,
        windowSeconds: 60,
      },
    );

    /*
     * ============================
     * LOGOUT
     * ============================
     */
    if (
      input.action === "logout"
    ) {
      await db.auth.signOut();

      return Response.json({
        message:
          "Sessão encerrada.",
      });
    }

    /*
     * ============================
     * NOTIFICAÇÃO
     * ============================
     */
    if (
      input.action === "read"
    ) {
      let q = db
        .from("notifications")
        .update({
          read: true,
        })
        .eq(
          "user_id",
          user.id,
        );

      if (input.id !== "all") {
        q = q.eq(
          "id",
          input.id,
        );
      }

      const { error } =
        await q;

      if (error) {
        throw error;
      }
    }

    /*
     * ============================
     * PERFIL
     * ============================
     */
    if (
      input.action === "profile"
    ) {
      const { error } =
        await db
          .from("profiles")
          .update({
            name: input.name,
            phone:
              input.phone,
          })
          .eq(
            "id",
            user.id,
          );

      if (error) {
        throw error;
      }
    }

    /*
     * ============================
     * TASK
     * ============================
     */
    if (
      input.action === "task"
    ) {
      const { error } =
        await db
          .from("user_tasks")
          .upsert(
            {
              user_id:
                user.id,

              task_key:
                input.taskKey,
            },
            {
              onConflict:
                "user_id,task_key",
            },
          );

      if (error) {
        throw error;
      }

      return Response.json({
        message:
          "Meta concluída.",
      });
    }

    /*
     * ============================
     * RECOMPENSAS
     * ============================
     */
    if (
      input.action ===
      "claimReward"
    ) {
      const {
        data: reward,
        error,
      } = await db.rpc(
        "claim_goal_reward",
        {
          p_goal_key:
            input.goalKey,
        },
      );

      if (error) {
        throw error;
      }

      return Response.json({
        message:
          "Bônus enviado para validação.",
        reward,
      });
    }

    /*
     * ============================
     * COMPRA DE PROJETO
     * ============================
     */
    if (
      input.action ===
      "purchase"
    ) {
      const {
        data: holdingId,
        error,
      } = await db.rpc(
        "purchase_solar_project",
        {
          p_project_id:
            input.projectId,

          p_quantity:
            input.quantity,
        },
      );

      if (error) {
        throw error;
      }

      return Response.json({
        message:
          "Participação registrada com segurança.",
        id: holdingId,
      });
    }

    /*
     * ============================
     * PIX / DEPÓSITO
     * ============================
     */
    if (
      input.action === "deposit"
    ) {
      /*
       * Camada 1:
       * rate limit por usuário.
       */
      await rateLimit(
        `pix-user:${user.id}`,
        {
          limit: 2,
          windowSeconds: 60,
        },
      );

      /*
       * Camada 2:
       * rate limit por IP.
       */
      await rateLimit(
        `pix-ip:${ip}`,
        {
          limit: 5,
          windowSeconds: 60,
        },
      );

      /*
       * Camada 3:
       * impede múltiplos PIX
       * pendentes recentes.
       */
      const pendingSince =
        new Date(
          Date.now() -
            15 *
              60 *
              1000,
        ).toISOString();

      const {
        count:
          pendingDeposits,
        error:
          pendingError,
      } = await db
        .from("deposits")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "user_id",
          user.id,
        )
        .eq(
          "status",
          "pending",
        )
        .gte(
          "created_at",
          pendingSince,
        );

      if (pendingError) {
        throw pendingError;
      }

      if (
        (pendingDeposits ??
          0) >= 1
      ) {
        return Response.json(
          {
            error:
              "Você já possui um PIX aguardando pagamento. Aguarde antes de gerar outro.",
          },
          {
            status: 429,
            headers: {
              "Retry-After":
                "60",
            },
          },
        );
      }

      /*
       * Camada 4:
       * máximo 20 cobranças
       * criadas em 24 horas
       * por usuário.
       */
      const last24Hours =
        new Date(
          Date.now() -
            24 *
              60 *
              60 *
              1000,
        ).toISOString();

      const {
        count:
          depositsToday,
        error:
          countError,
      } = await db
        .from("deposits")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "user_id",
          user.id,
        )
        .gte(
          "created_at",
          last24Hours,
        );

      if (countError) {
        throw countError;
      }

      if (
        (depositsToday ??
          0) >= 20
      ) {
        return Response.json(
          {
            error:
              "Limite diário de geração de PIX atingido.",
          },
          {
            status: 429,
          },
        );
      }

      /*
       * ============================
       * SESSÃO
       * ============================
       */
      const {
        data: sessionData,
      } =
        await db.auth.getSession();

      const session =
        sessionData.session;

      if (!session) {
        return Response.json(
          {
            error:
              "Entre novamente na sua conta.",
          },
          {
            status: 401,
          },
        );
      }

      /*
       * ============================
       * CHAMADA SYNCPAY
       * ============================
       */
      const cashin =
        await fetch(
          `${SUPABASE_URL}/functions/v1/syncpay-cash-in`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,

              apikey:
                SUPABASE_PUBLISHABLE_KEY,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                amount:
                  input.amount,

                cpf:
                  input.cpf,
              }),

            cache: "no-store",
          },
        );

      const result =
        await cashin
          .json()
          .catch(
            () => ({}),
          );

      if (!cashin.ok) {
        throw new Error(
          result.error ??
            "Não foi possível gerar o PIX.",
        );
      }

      return Response.json(
        result,
      );
    }

    /*
     * ============================
     * STATUS DO PIX
     * ============================
     */
    if (
      input.action ===
      "depositStatus"
    ) {
      /*
       * Polling normal do site
       * ocorre a cada ~3s.
       * 25/min dá margem suficiente.
       */
      await rateLimit(
        `pix-status-user:${user.id}`,
        {
          limit: 25,
          windowSeconds: 60,
        },
      );

      await rateLimit(
        `pix-status-ip:${ip}`,
        {
          limit: 60,
          windowSeconds: 60,
        },
      );

      const {
        data: sessionData,
      } =
        await db.auth.getSession();

      const session =
        sessionData.session;

      if (!session) {
        return Response.json(
          {
            error:
              "Entre novamente na sua conta.",
          },
          {
            status: 401,
          },
        );
      }

      /*
       * Reconcilia o PIX.
       *
       * O webhook ainda continua
       * sendo a principal fonte
       * de verdade.
       */
      try {
        await fetch(
          `${SUPABASE_URL}/functions/v1/syncpay-reconcile`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,

              apikey:
                SUPABASE_PUBLISHABLE_KEY,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                depositId:
                  input.id,
              }),

            cache:
              "no-store",
          },
        );
      } catch {
        /*
         * Webhook e cron continuam
         * funcionando como fallback.
         */
      }

      const {
        data: deposit,
        error,
      } = await db
        .from("deposits")
        .select(
          "id,amount,status,gateway_id,provider_status,paid_at",
        )
        .eq(
          "id",
          input.id,
        )
        .eq(
          "user_id",
          user.id,
        )
        .single();

      if (
        error ||
        !deposit
      ) {
        throw new Error(
          "Recarga não encontrada.",
        );
      }

      return Response.json({
        deposit,
      });
    }

    /*
     * ============================
     * SAQUE
     * ============================
     */
    if (
      input.action ===
      "withdrawal"
    ) {
      if (
        !isWithdrawalWindow()
      ) {
        throw new Error(
          `Saques disponíveis ${withdrawalWindowLabel}, no horário de Brasília.`,
        );
      }

      const {
        data: withdrawal,
        error,
      } = await db.rpc(
        "request_withdrawal",
        {
          p_amount:
            input.amount,

          p_pix_key:
            input.pixKey,

          p_pix_key_type:
            input.pixKeyType,
        },
      );

      if (error) {
        throw error;
      }

      return Response.json({
        withdrawal,

        message:
          "Solicitação de saque registrada. O valor foi reservado da carteira.",
      });
    }

    return Response.json({
      message:
        "Atualizado com sucesso.",
    });
  } catch (error) {
    /*
     * ============================
     * RATE LIMIT
     * ============================
     */
    if (
      error instanceof
      RateLimitError
    ) {
      return Response.json(
        {
          error:
            error.message,
        },
        {
          status: 429,
          headers: {
            "Retry-After":
              "60",

            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    /*
     * ============================
     * DEMAIS ERROS
     * ============================
     */
    return Response.json(
      {
        error:
          error instanceof
          z.ZodError
            ? "Revise os dados informados."
            : error instanceof
                Error
              ? error.message
              : "Não foi possível concluir.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }
}
