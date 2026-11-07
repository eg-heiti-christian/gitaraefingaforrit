-- DropIndex
DROP INDEX "PracticeItem_userId_idx";

-- CreateIndex
CREATE INDEX "PracticeItem_userId_createdAt_id_idx" ON "PracticeItem"("userId", "createdAt", "id");
