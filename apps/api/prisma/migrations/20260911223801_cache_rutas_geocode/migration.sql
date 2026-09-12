-- CreateTable
CREATE TABLE "RutaCache" (
    "id" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "metros" INTEGER NOT NULL,
    "segundos" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RutaCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "id" TEXT NOT NULL,
    "consulta" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RutaCache_creadoEn_idx" ON "RutaCache"("creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "RutaCache_origen_destino_key" ON "RutaCache"("origen", "destino");

-- CreateIndex
CREATE UNIQUE INDEX "GeocodeCache_consulta_key" ON "GeocodeCache"("consulta");
