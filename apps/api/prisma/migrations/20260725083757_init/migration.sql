-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Mi perfil',
    "homeAddress" TEXT,
    "homeMunicipality" TEXT,
    "homeLat" DOUBLE PRECISION,
    "homeLng" DOUBLE PRECISION,
    "maxDistanceKm" DOUBLE PRECISION,
    "maxTravelMinutes" INTEGER,
    "acceptsPartialWorkload" BOOLEAN NOT NULL DEFAULT true,
    "minimumWorkload" DOUBLE PRECISION,
    "acceptsVoluntary" BOOLEAN NOT NULL DEFAULT true,
    "acceptsAfternoon" BOOLEAN NOT NULL DEFAULT false,
    "acceptsItinerant" BOOLEAN NOT NULL DEFAULT false,
    "acceptsBilingual" BOOLEAN NOT NULL DEFAULT false,
    "acceptsLongTerm" BOOLEAN NOT NULL DEFAULT true,
    "specialties" JSONB NOT NULL,
    "acceptedLanguages" JSONB NOT NULL DEFAULT '[]',
    "excludedPrograms" JSONB NOT NULL DEFAULT '[]',
    "excludedTags" JSONB NOT NULL DEFAULT '[]',
    "preferredMunicipalities" JSONB NOT NULL DEFAULT '[]',
    "excludedMunicipalities" JSONB NOT NULL DEFAULT '[]',
    "preferredCenters" JSONB NOT NULL DEFAULT '[]',
    "excludedCenters" JSONB NOT NULL DEFAULT '[]',
    "rankingWeights" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convocatoria" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "community" TEXT NOT NULL DEFAULT 'aragon',
    "sourceName" TEXT,
    "parserVersion" TEXT NOT NULL DEFAULT 'aragon_v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Convocatoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vacancy" (
    "id" TEXT NOT NULL,
    "convocatoriaId" TEXT NOT NULL,
    "externalId" TEXT,
    "province" TEXT,
    "municipality" TEXT,
    "bodyCode" TEXT,
    "specialtyCode" TEXT,
    "specialtyName" TEXT,
    "centerCode" TEXT,
    "centerName" TEXT,
    "centerAddress" TEXT,
    "workload" DOUBLE PRECISION,
    "scheduleType" TEXT,
    "voluntary" BOOLEAN NOT NULL DEFAULT false,
    "durationType" TEXT,
    "additionalInfoRaw" TEXT,
    "requirements" JSONB NOT NULL DEFAULT '[]',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sourcePage" INTEGER,
    "sourceRow" INTEGER,

    CONSTRAINT "Vacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "convocatoriaId" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "included" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distanceKm" DOUBLE PRECISION,
    "travelMinutes" INTEGER,
    "requiresManualReview" BOOLEAN NOT NULL DEFAULT false,
    "hardExclusionReasons" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "positiveReasons" JSONB NOT NULL DEFAULT '[]',
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "concept" TEXT NOT NULL DEFAULT 'campana',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convocatoria" ADD CONSTRAINT "Convocatoria_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vacancy" ADD CONSTRAINT "Vacancy_convocatoriaId_fkey" FOREIGN KEY ("convocatoriaId") REFERENCES "Convocatoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_convocatoriaId_fkey" FOREIGN KEY ("convocatoriaId") REFERENCES "Convocatoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
