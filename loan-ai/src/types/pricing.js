/**

 * @typedef {Object} UsageLimits

 * @property {number} [LOAN_APPLICATIONS]

 * @property {number} [ACTIVE_USERS]

 * @property {number} [LOAN_OFFICERS]

 * @property {number} [LENDER_CONNECTIONS]

 */



/**

 * @typedef {Object} SubscriptionPackage

 * @property {string} id

 * @property {string} name

 * @property {string} code

 * @property {number} priceMonthly

 * @property {number | null} [priceYearly]

 * @property {boolean} [isPopular]

 * @property {string | null} [description]

 * @property {string[] | string} [features]

 * @property {UsageLimits | null} [usageLimits]

 * @property {number} sortOrder

 */



/**

 * @typedef {Object} SubscriptionAddOn

 * @property {string} code

 * @property {string} name

 * @property {number} priceMonthly

 * @property {string} [note]

 * @property {boolean} [isPurchasable]

 * @property {string[]} [includedInPackageCodes]

 */



export {};
