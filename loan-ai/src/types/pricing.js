/**
 * @typedef {Object} UsageLimits
 * @property {number} [LOAN_APPLICATIONS]
 * @property {number} [ACTIVE_USERS]
 * @property {number} [LOAN_OFFICERS]
 * @property {number} [LENDER_CONNECTIONS]
 */

/**
 * @typedef {Object} FeatureItem
 * @property {string} label
 * @property {string[]} [children]
 */

/**
 * @typedef {Object} FeatureGroup
 * @property {string | null} [heading]
 * @property {(string | FeatureItem)[]} items
 * @property {"default" | "highlight"} [variant]
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
 * @property {FeatureGroup[]} [featureGroups]
 * @property {string | null} [badge]
 * @property {string | null} [usersLabel]
 * @property {number | null} [includedUsers]
 * @property {number | null} [maxUsers]
 * @property {number | null} [extraUserPrice]
 * @property {UsageLimits | null} [usageLimits]
 * @property {number} sortOrder
 */

/**
 * @typedef {Object} SubscriptionAddOn
 * @property {string} code
 * @property {string} name
 * @property {number} priceMonthly
 * @property {Record<string, number>} [priceByPackage]
 * @property {string} [note]
 * @property {boolean} [isPurchasable]
 * @property {boolean} [quantityBased]
 * @property {string[]} [includedInPackageCodes]
 * @property {string[]} [availableForPackageCodes]
 * @property {number} [quantity]
 */

export {};
