-- CreateTable
CREATE TABLE "Acceso" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Acceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Acceso_createdAt_idx" ON "Acceso"("createdAt");

-- CreateIndex
CREATE INDEX "Acceso_userId_createdAt_idx" ON "Acceso"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Acceso" ADD CONSTRAINT "Acceso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
