import { isAblBase44Product, isEquipmentFinanceProduct } from "./ablBase44";
import { isSba7aBusinessCollateralProduct } from "./sba7aAcquisition";

/** Products that use Business / Industry Type on the property step. */
export const isBase44BusinessCollateralProduct = (product: string) =>
  isSba7aBusinessCollateralProduct(product) || isAblBase44Product(product);

export { isAblBase44Product, isEquipmentFinanceProduct };
