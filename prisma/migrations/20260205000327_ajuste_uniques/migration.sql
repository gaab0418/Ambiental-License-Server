/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `license_types` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "license_types_name_key" ON "license_types"("name");
