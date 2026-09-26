-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluations_jobId_candidateId_idx" ON "evaluations"("jobId", "candidateId");

-- CreateIndex
CREATE INDEX "evaluations_candidateId_idx" ON "evaluations"("candidateId");

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_candidateId_fkey"
FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
