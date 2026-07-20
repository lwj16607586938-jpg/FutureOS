-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "avatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "stage" TEXT NOT NULL DEFAULT 'CREATED',
    "date" TEXT NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Learning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 8,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Learning_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "answer" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Question_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "targetDate" DATETIME NOT NULL,
    "tag" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" DATETIME,
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prediction_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "weakness" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "observe" INTEGER NOT NULL DEFAULT 50,
    "understand" INTEGER NOT NULL DEFAULT 50,
    "connect" INTEGER NOT NULL DEFAULT 50,
    "reason" INTEGER NOT NULL DEFAULT 50,
    "predict" INTEGER NOT NULL DEFAULT 50,
    "update" INTEGER NOT NULL DEFAULT 50,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AbilityHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "abilityId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "reason" TEXT,
    "missionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AbilityHistory_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "difficulty" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KnowledgeEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "knowledgeNodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "completedMissionId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeProgress_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyStatistics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "missionCount" INTEGER NOT NULL DEFAULT 0,
    "predictionCount" INTEGER NOT NULL DEFAULT 0,
    "knowledgeCount" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyStatistics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Mission_userId_createdAt_idx" ON "Mission"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_userId_date_key" ON "Mission"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Learning_missionId_key" ON "Learning"("missionId");

-- CreateIndex
CREATE INDEX "Question_missionId_idx" ON "Question"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_missionId_order_key" ON "Question"("missionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_missionId_key" ON "Prediction"("missionId");

-- CreateIndex
CREATE INDEX "Prediction_status_idx" ON "Prediction"("status");

-- CreateIndex
CREATE INDEX "Prediction_targetDate_idx" ON "Prediction"("targetDate");

-- CreateIndex
CREATE UNIQUE INDEX "Review_missionId_key" ON "Review"("missionId");

-- CreateIndex
CREATE INDEX "Ability_userId_idx" ON "Ability"("userId");

-- CreateIndex
CREATE INDEX "AbilityHistory_abilityId_idx" ON "AbilityHistory"("abilityId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeNode_slug_key" ON "KnowledgeNode"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeNode_slug_idx" ON "KnowledgeNode"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeEdge_sourceNodeId_idx" ON "KnowledgeEdge"("sourceNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEdge_sourceNodeId_targetNodeId_relation_key" ON "KnowledgeEdge"("sourceNodeId", "targetNodeId", "relation");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeProgress_userId_knowledgeNodeId_key" ON "KnowledgeProgress"("userId", "knowledgeNodeId");
