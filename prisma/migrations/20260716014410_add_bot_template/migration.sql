-- CreateTable
CREATE TABLE "BotTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceBot" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotTemplate_pkey" PRIMARY KEY ("id")
);
