// animal-registry.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface AnimalEntry {
  hash: Uint8Array; // buff 32
  owner: string;
  registrationTimestamp: number;
  breed: string;
  species: string;
  gender: string;
  birthDate: number;
  location: string;
  description: string;
  status: string;
  tags: string[];
}

interface UpdateEntry {
  updater: string;
  timestamp: number;
  fieldUpdated: string;
  oldValue: string;
  newValue: string;
}

interface ContractState {
  lastAnimalId: number;
  contractPaused: boolean;
  admin: string;
  animals: Map<number, AnimalEntry>;
  animalHashes: Map<string, { animalId: number }>; // Hash as string for simplicity
  updateHistory: Map<string, UpdateEntry>; // Key as `${animalId}-${updateId}`
  updateCounters: Map<number, { count: number }>;
}

// Mock contract implementation
class AnimalRegistryMock {
  private state: ContractState = {
    lastAnimalId: 0,
    contractPaused: false,
    admin: "deployer",
    animals: new Map(),
    animalHashes: new Map(),
    updateHistory: new Map(),
    updateCounters: new Map(),
  };

  private ERR_ALREADY_REGISTERED = 100;
  private ERR_UNAUTHORIZED = 101;
  private ERR_INVALID_PARAM = 103;
  private ERR_NOT_FOUND = 104;
  private ERR_PAUSED = 105;
  private ERR_MAX_TAGS_EXCEEDED = 107;
  private ERR_INVALID_STATUS = 108;

  private MAX_TAGS = 10;
  private MAX_DESCRIPTION_LEN = 500;
  private MAX_LOCATION_LEN = 100;

  private computeAnimalHash(breed: string, species: string, gender: string, birthDate: number, location: string): string {
    // Simulate hash as string concatenation for testing
    return `${breed}-${species}-${gender}-${birthDate}-${location}`;
  }

  private isAdmin(caller: string): boolean {
    return caller === this.state.admin;
  }

  private isOwner(animalId: number, caller: string): boolean {
    const entry = this.state.animals.get(animalId);
    return entry ? entry.owner === caller : false;
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (!this.isAdmin(caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.contractPaused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (!this.isAdmin(caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.contractPaused = false;
    return { ok: true, value: true };
  }

  setAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (!this.isAdmin(caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  registerAnimal(
    caller: string,
    breed: string,
    species: string,
    gender: string,
    birthDate: number,
    location: string,
    description: string,
    status: string,
    tags: string[]
  ): ClarityResponse<number> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (breed.length === 0 || species.length === 0) {
      return { ok: false, value: this.ERR_INVALID_PARAM };
    }
    if (description.length > this.MAX_DESCRIPTION_LEN || location.length > this.MAX_LOCATION_LEN) {
      return { ok: false, value: this.ERR_INVALID_PARAM };
    }
    if (tags.length > this.MAX_TAGS) {
      return { ok: false, value: this.ERR_MAX_TAGS_EXCEEDED };
    }
    if (!["active", "pending"].includes(status)) {
      return { ok: false, value: this.ERR_INVALID_STATUS };
    }
    const hash = this.computeAnimalHash(breed, species, gender, birthDate, location);
    if (this.state.animalHashes.has(hash)) {
      return { ok: false, value: this.ERR_ALREADY_REGISTERED };
    }
    const newId = this.state.lastAnimalId + 1;
    this.state.animals.set(newId, {
      hash: new Uint8Array(), // Placeholder
      owner: caller,
      registrationTimestamp: Date.now(),
      breed,
      species,
      gender,
      birthDate,
      location,
      description,
      status,
      tags,
    });
    this.state.animalHashes.set(hash, { animalId: newId });
    this.state.updateCounters.set(newId, { count: 0 });
    this.state.lastAnimalId = newId;
    return { ok: true, value: newId };
  }

  updateAnimalLocation(caller: string, animalId: number, newLocation: string): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const entry = this.state.animals.get(animalId);
    if (!entry) {
      return { ok: false, value: this.ERR_NOT_FOUND };
    }
    if (!this.isOwner(animalId, caller) && !this.isAdmin(caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (newLocation.length > this.MAX_LOCATION_LEN) {
      return { ok: false, value: this.ERR_INVALID_PARAM };
    }
    const oldLocation = entry.location;
    entry.location = newLocation;
    const updateCount = (this.state.updateCounters.get(animalId)?.count ?? 0) + 1;
    this.state.updateHistory.set(`${animalId}-${updateCount}`, {
      updater: caller,
      timestamp: Date.now(),
      fieldUpdated: "location",
      oldValue: oldLocation,
      newValue: newLocation,
    });
    this.state.updateCounters.set(animalId, { count: updateCount });
    return { ok: true, value: true };
  }

  updateAnimalStatus(caller: string, animalId: number, newStatus: string): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const entry = this.state.animals.get(animalId);
    if (!entry) {
      return { ok: false, value: this.ERR_NOT_FOUND };
    }
    if (!this.isOwner(animalId, caller) && !this.isAdmin(caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (!["active", "sold", "deceased", "quarantined"].includes(newStatus)) {
      return { ok: false, value: this.ERR_INVALID_STATUS };
    }
    const oldStatus = entry.status;
    entry.status = newStatus;
    const updateCount = (this.state.updateCounters.get(animalId)?.count ?? 0) + 1;
    this.state.updateHistory.set(`${animalId}-${updateCount}`, {
      updater: caller,
      timestamp: Date.now(),
      fieldUpdated: "status",
      oldValue: oldStatus,
      newValue: newStatus,
    });
    this.state.updateCounters.set(animalId, { count: updateCount });
    return { ok: true, value: true };
  }

  transferOwnership(caller: string, animalId: number, newOwner: string): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const entry = this.state.animals.get(animalId);
    if (!entry) {
      return { ok: false, value: this.ERR_NOT_FOUND };
    }
    if (!this.isOwner(animalId, caller)) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const oldOwner = entry.owner;
    entry.owner = newOwner;
    const updateCount = (this.state.updateCounters.get(animalId)?.count ?? 0) + 1;
    this.state.updateHistory.set(`${animalId}-${updateCount}`, {
      updater: caller,
      timestamp: Date.now(),
      fieldUpdated: "owner",
      oldValue: oldOwner,
      newValue: newOwner,
    });
    this.state.updateCounters.set(animalId, { count: updateCount });
    return { ok: true, value: true };
  }

  getAnimalDetails(animalId: number): ClarityResponse<AnimalEntry | null> {
    return { ok: true, value: this.state.animals.get(animalId) ?? null };
  }

  getAnimalByHash(hash: string): ClarityResponse<AnimalEntry | null> {
    const id = this.state.animalHashes.get(hash)?.animalId;
    return { ok: true, value: id ? this.state.animals.get(id) ?? null : null };
  }

  verifyOwnership(animalId: number, owner: string): ClarityResponse<boolean> {
    const entry = this.state.animals.get(animalId);
    return { ok: true, value: entry ? entry.owner === owner : false };
  }

  getUpdateHistory(animalId: number, updateId: number): ClarityResponse<UpdateEntry | null> {
    return { ok: true, value: this.state.updateHistory.get(`${animalId}-${updateId}`) ?? null };
  }

  getUpdateCount(animalId: number): ClarityResponse<{ count: number }> {
    return { ok: true, value: this.state.updateCounters.get(animalId) ?? { count: 0 } };
  }

  isContractPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.contractPaused };
  }

  getAdmin(): ClarityResponse<string> {
    return { ok: true, value: this.state.admin };
  }

  getLastAnimalId(): ClarityResponse<number> {
    return { ok: true, value: this.state.lastAnimalId };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  farmer1: "farmer1",
  farmer2: "farmer2",
  admin: "deployer",
};

describe("AnimalRegistry Contract", () => {
  let contract: AnimalRegistryMock;

  beforeEach(() => {
    contract = new AnimalRegistryMock();
    vi.resetAllMocks();
  });

  it("should allow admin to pause and unpause the contract", () => {
    let result = contract.pauseContract(accounts.deployer);
    expect(result).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: true });

    result = contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      ["dairy"]
    );
    expect(result).toEqual({ ok: false, value: 105 });

    result = contract.unpauseContract(accounts.deployer);
    expect(result).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });
  });

  it("should prevent non-admin from pausing", () => {
    const result = contract.pauseContract(accounts.farmer1);
    expect(result).toEqual({ ok: false, value: 101 });
  });

  it("should register a new animal successfully", () => {
    const result = contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      ["dairy", "organic"]
    );
    expect(result).toEqual({ ok: true, value: 1 });
    expect(contract.getLastAnimalId()).toEqual({ ok: true, value: 1 });

    const details = contract.getAnimalDetails(1);
    expect(details).toEqual({
      ok: true,
      value: expect.objectContaining({
        owner: accounts.farmer1,
        breed: "Holstein",
        species: "Cow",
        gender: "female",
        birthDate: 1692921600,
        location: "Farm A",
        description: "Healthy calf",
        status: "active",
        tags: ["dairy", "organic"],
      }),
    });
  });

  it("should prevent duplicate registration via hash", () => {
    contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      ["dairy"]
    );

    const duplicate = contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Another calf",
      "active",
      ["dairy"]
    );
    expect(duplicate).toEqual({ ok: false, value: 100 });
  });

  it("should allow owner to update location and record history", () => {
    contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      ["dairy"]
    );

    const update = contract.updateAnimalLocation(accounts.farmer1, 1, "Farm B");
    expect(update).toEqual({ ok: true, value: true });

    const details = contract.getAnimalDetails(1);
    expect(details.value?.location).toBe("Farm B");

    const history = contract.getUpdateHistory(1, 1);
    expect(history).toEqual({
      ok: true,
      value: expect.objectContaining({
        fieldUpdated: "location",
        oldValue: "Farm A",
        newValue: "Farm B",
      }),
    });

    expect(contract.getUpdateCount(1)).toEqual({ ok: true, value: { count: 1 } });
  });

  it("should prevent non-owner from updating location", () => {
    contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      ["dairy"]
    );

    const update = contract.updateAnimalLocation(accounts.farmer2, 1, "Farm B");
    expect(update).toEqual({ ok: false, value: 101 });
  });

  it("should allow admin to update status", () => {
    contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      ["dairy"]
    );

    const update = contract.updateAnimalStatus(accounts.deployer, 1, "quarantined");
    expect(update).toEqual({ ok: true, value: true });

    const details = contract.getAnimalDetails(1);
    expect(details.value?.status).toBe("quarantined");
  });

  it("should prevent invalid status updates", () => {
    contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      ["dairy"]
    );

    const update = contract.updateAnimalStatus(accounts.farmer1, 1, "invalid");
    expect(update).toEqual({ ok: false, value: 108 });
  });

  it("should allow owner to transfer ownership", () => {
    contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      ["dairy"]
    );

    const transfer = contract.transferOwnership(accounts.farmer1, 1, accounts.farmer2);
    expect(transfer).toEqual({ ok: true, value: true });

    const verify = contract.verifyOwnership(1, accounts.farmer2);
    expect(verify).toEqual({ ok: true, value: true });

    const history = contract.getUpdateHistory(1, 1);
    expect(history).toEqual({
      ok: true,
      value: expect.objectContaining({
        fieldUpdated: "owner",
        oldValue: accounts.farmer1,
        newValue: accounts.farmer2,
      }),
    });
  });

  it("should prevent non-owner from transferring ownership", () => {
    contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      ["dairy"]
    );

    const transfer = contract.transferOwnership(accounts.farmer2, 1, accounts.farmer2);
    expect(transfer).toEqual({ ok: false, value: 101 });
  });

  it("should handle invalid parameters in registration", () => {
    const tooManyTags = new Array(11).fill("tag");
    let result = contract.registerAnimal(
      accounts.farmer1,
      "",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      ["dairy"]
    );
    expect(result).toEqual({ ok: false, value: 103 });

    result = contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "a".repeat(501),
      "active",
      ["dairy"]
    );
    expect(result).toEqual({ ok: false, value: 103 });

    result = contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "invalid",
      ["dairy"]
    );
    expect(result).toEqual({ ok: false, value: 108 });

    result = contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      tooManyTags
    );
    expect(result).toEqual({ ok: false, value: 107 });
  });

  it("should retrieve animal by hash", () => {
    contract.registerAnimal(
      accounts.farmer1,
      "Holstein",
      "Cow",
      "female",
      1692921600,
      "Farm A",
      "Healthy calf",
      "active",
      ["dairy"]
    );

    const hash = contract.computeAnimalHash("Holstein", "Cow", "female", 1692921600, "Farm A");
    const details = contract.getAnimalByHash(hash);
    expect(details).toEqual({
      ok: true,
      value: expect.objectContaining({
        breed: "Holstein",
      }),
    });
  });
});