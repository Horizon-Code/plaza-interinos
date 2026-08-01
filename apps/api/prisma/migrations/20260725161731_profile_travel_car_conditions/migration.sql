-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "dailyCostEur" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "carConsumption" DOUBLE PRECISION,
ADD COLUMN     "carFuelType" TEXT,
ADD COLUMN     "conditionAccepts" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "conditionTravelLimits" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "fuelPriceOverride" DOUBLE PRECISION,
ADD COLUMN     "travelMode" TEXT NOT NULL DEFAULT 'minutes',
ADD COLUMN     "workloadTravelTiers" JSONB NOT NULL DEFAULT '[]';
