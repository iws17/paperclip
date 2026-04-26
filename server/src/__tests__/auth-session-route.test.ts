import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { actorMiddleware } from "../middleware/auth.js";

function createSelectChain(rows: unknown[]) {
  return {
    from() {
      return {
        where() {
          return Promise.resolve(rows);
        },
      };
    },
  };
}

function createDb() {
  return {
    select: vi.fn(() => createSelectChain([])),
  } as any;
}

function createActorApp(deploymentMode: "authenticated" | "local_trusted") {
  const app = express();
  app.use(
    actorMiddleware(createDb(), {
      deploymentMode,
    }),
  );
  app.get("/actor", (req, res) => {
    res.json(req.actor);
  });
  return app;
}

describe("actorMiddleware authenticated session profile", () => {
  it("preserves the signed-in user name and email on the board actor", async () => {
    const app = express();
    app.use(
      actorMiddleware(createDb(), {
        deploymentMode: "authenticated",
        resolveSession: async () => ({
          session: { id: "session-1", userId: "user-1" },
          user: {
            id: "user-1",
            name: "User One",
            email: "user@example.com",
          },
        }),
      }),
    );
    app.get("/actor", (req, res) => {
      res.json(req.actor);
    });

    const res = await request(app).get("/actor");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      type: "board",
      userId: "user-1",
      userName: "User One",
      userEmail: "user@example.com",
      source: "session",
      companyIds: [],
      memberships: [],
      isInstanceAdmin: false,
    });
  });
});

describe("actorMiddleware local trusted auth fallback", () => {
  it("keeps no-auth local requests on the implicit board actor", async () => {
    const res = await request(createActorApp("local_trusted")).get("/actor");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      type: "board",
      userId: "local-board",
      source: "local_implicit",
    });
  });

  it("does not fall back to local board for invalid bearer auth", async () => {
    const res = await request(createActorApp("local_trusted"))
      .get("/actor")
      .set("Authorization", "Bearer not-a-real-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: "none",
      source: "none",
    });
  });

  it("does not fall back to local board for empty bearer auth", async () => {
    const res = await request(createActorApp("local_trusted"))
      .get("/actor")
      .set("Authorization", "Bearer ");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: "none",
      source: "none",
    });
  });

  it("does not fall back to local board for unsupported explicit auth schemes", async () => {
    const res = await request(createActorApp("local_trusted"))
      .get("/actor")
      .set("Authorization", "Basic not-supported");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: "none",
      source: "none",
    });
  });

  it("does not attach run id to unsupported explicit auth schemes", async () => {
    const res = await request(createActorApp("local_trusted"))
      .get("/actor")
      .set("Authorization", "Basic not-supported")
      .set("X-Paperclip-Run-Id", "run-1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: "none",
      source: "none",
    });
  });
});
