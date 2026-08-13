const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Mirror frontend validation rules for referring-broker step (Node-side unit checks).
function validateReferringBrokerStep(state) {
  const errors = {};
  if (!state.workingWithMortgageBroker) {
    errors.workingWithMortgageBroker = "Please select Yes or No";
    return errors;
  }
  if (state.workingWithMortgageBroker !== "yes") return errors;
  const broker = state.referringBroker || {};
  if (!String(broker.email || "").trim()) {
    errors["referringBroker.email"] = "Email address is required";
  }
  if (!String(broker.firstName || "").trim()) {
    errors["referringBroker.firstName"] = "First name is required";
  }
  if (!String(broker.lastName || "").trim()) {
    errors["referringBroker.lastName"] = "Last name is required";
  }
  if (!String(broker.companyName || "").trim()) {
    errors["referringBroker.companyName"] = "Company name is required";
  }
  if (!String(broker.phone || "").trim()) {
    errors["referringBroker.phone"] = "Phone number is required";
  }
  return errors;
}

function shouldShowReferringBrokerStep(sourcePortal) {
  return sourcePortal === "BROKER" || sourcePortal === "LOAN_OFFICER";
}

describe("Referring broker public-application step", () => {
  it("shows step for Broker and LO only", () => {
    assert.equal(shouldShowReferringBrokerStep("BROKER"), true);
    assert.equal(shouldShowReferringBrokerStep("LOAN_OFFICER"), true);
    assert.equal(shouldShowReferringBrokerStep("CO_BROKER"), false);
    assert.equal(shouldShowReferringBrokerStep("LEGACY"), false);
  });

  it("requires Yes/No before continuing", () => {
    const errors = validateReferringBrokerStep({
      workingWithMortgageBroker: "",
      referringBroker: {},
    });
    assert.equal(errors.workingWithMortgageBroker, "Please select Yes or No");
  });

  it("does not require broker fields when No is selected", () => {
    const errors = validateReferringBrokerStep({
      workingWithMortgageBroker: "no",
      referringBroker: {},
    });
    assert.deepEqual(errors, {});
  });

  it("requires broker fields when Yes is selected", () => {
    const errors = validateReferringBrokerStep({
      workingWithMortgageBroker: "yes",
      referringBroker: {
        email: "",
        firstName: "",
        lastName: "",
        companyName: "",
        phone: "",
      },
    });
    assert.ok(errors["referringBroker.email"]);
    assert.ok(errors["referringBroker.firstName"]);
    assert.ok(errors["referringBroker.lastName"]);
    assert.ok(errors["referringBroker.companyName"]);
    assert.ok(errors["referringBroker.phone"]);
  });

  it("passes when Yes and all broker fields are present", () => {
    const errors = validateReferringBrokerStep({
      workingWithMortgageBroker: "yes",
      referringBroker: {
        email: "broker@example.com",
        firstName: "Pat",
        lastName: "Lee",
        companyName: "Lee Lending",
        phone: "555-123-4567",
      },
    });
    assert.deepEqual(errors, {});
  });
});
