import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  ai: router({
    coachChat: publicProcedure
      .input(
        z.object({
          message: z.string().min(1).max(1200),
          history: z
            .array(
              z.object({
                role: z.enum(["user", "coach"]),
                text: z.string().min(1).max(1200),
              }),
            )
            .max(20)
            .optional(),
          context: z
            .object({
              today: z.string().optional(),
              currentExercise: z.string().nullable().optional(),
              isSessionActive: z.boolean().optional(),
              recentSessions: z
                .array(
                  z.object({
                    date: z.string(),
                    total_sets: z.number().nullable().optional(),
                    total_volume: z.number().nullable().optional(),
                  }),
                )
                .optional(),
            })
            .passthrough()
            .optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const historyMessages = (input.history ?? []).map((m) => ({
          role: m.role === "coach" ? ("assistant" as const) : ("user" as const),
          content: m.text,
        }));

        const contextText = input.context
          ? `トレーニングコンテキスト(JSON):\n${JSON.stringify(input.context, null, 2)}`
          : "トレーニングコンテキスト: なし";

        const response = await invokeLLM({
          model: "glm-4.7",
          messages: [
            {
              role: "system",
              content:
                "あなたは日本語のストレングスコーチです。短く具体的に答えてください。与えられたトレーニングデータを優先し、足りないときだけ不足点を1行で示してください。安全と回復を優先してください。",
            },
            {
              role: "system",
              content: contextText,
            },
            ...historyMessages,
            {
              role: "user",
              content: input.message,
            },
          ],
          max_tokens: 700,
        });

        const content = response.choices?.[0]?.message?.content;
        const text =
          typeof content === "string"
            ? content
            : Array.isArray(content)
              ? content
                  .filter((c): c is { type: "text"; text: string } => c.type === "text")
                  .map((c) => c.text)
                  .join("\n")
              : "";

        return {
          text: text || "回答を生成できませんでした。もう一度お試しください。",
        };
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
