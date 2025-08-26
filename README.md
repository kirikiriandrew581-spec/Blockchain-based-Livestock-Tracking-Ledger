# 🐄 Blockchain-based Livestock Tracking Ledger

Welcome to a revolutionary way to track livestock health and history on the blockchain! This project uses the Stacks blockchain and Clarity smart contracts to create an immutable ledger for recording animal data, helping prevent disease outbreaks like avian flu by ensuring transparent, tamper-proof tracking of health checks, feed history, vaccinations, and ownership transfers. Farmers, veterinarians, and regulators can collaborate securely, enabling early detection of issues and compliance with food safety standards.

## ✨ Features

🔒 Immutable recording of animal health metrics, feed logs, and vaccination history  
📊 Real-time querying and verification of livestock data for auditors and buyers  
🚨 Automated alerts for potential disease risks based on health patterns  
🔄 Secure ownership transfers with provenance tracking  
📈 Analytics for farm-wide insights to optimize animal welfare  
🚫 Prevention of data tampering or duplicate entries  
🌐 Integration with supply chain for feed traceability  
✅ Compliance reporting for regulatory bodies  

## 🛠 How It Works

This system is built with 8 modular Clarity smart contracts, each handling a specific aspect of livestock tracking. They interact seamlessly to maintain data integrity while allowing authorized parties (e.g., farmers, vets) to update records. All data is hashed and timestamped on the Stacks blockchain for immutability.

### Core Smart Contracts

1. **AnimalRegistry.clar**: Registers new animals with unique IDs, breed, birth date, and initial owner. Prevents duplicates by checking hashes of animal details.  
   - Key functions: `register-animal (id: uint, breed: (string-ascii 50), birth-date: uint, owner: principal)`, `get-animal-details (id: uint)`.

2. **OwnershipTracker.clar**: Manages ownership transfers and tracks provenance history. Ensures only current owners can transfer.  
   - Key functions: `transfer-ownership (animal-id: uint, new-owner: principal)`, `get-ownership-history (animal-id: uint)`.

3. **HealthRecords.clar**: Logs health checks, including weight, temperature, and symptoms. Appends immutable entries with timestamps.  
   - Key functions: `record-health-check (animal-id: uint, timestamp: uint, metrics: (tuple (weight uint) (temp uint) (symptoms (string-ascii 200))))`, `get-health-history (animal-id: uint)`.

4. **FeedHistory.clar**: Tracks feed types, quantities, and sources given to animals, linking to supply chain data for traceability.  
   - Key functions: `log-feed (animal-id: uint, timestamp: uint, feed-type: (string-ascii 50), quantity: uint, supplier: principal)`, `get-feed-history (animal-id: uint)`.

5. **VaccinationLedger.clar**: Records vaccinations, including type, date, and batch info, to ensure compliance and prevent outbreaks.  
   - Key functions: `add-vaccination (animal-id: uint, vaccine-type: (string-ascii 50), date: uint, batch-id: (string-ascii 20))`, `verify-vaccination-status (animal-id: uint)`.

6. **DiseaseAlert.clar**: Analyzes health and feed data to flag risks (e.g., patterns matching avian flu symptoms). Triggers notifications via off-chain integrations.  
   - Key functions: `check-for-alerts (animal-id: uint)`, `get-alert-history (farm-id: uint)` (aggregates across animals).

7. **AccessControl.clar**: Handles permissions for users (farmers, vets, regulators). Uses roles to control read/write access.  
   - Key functions: `grant-role (user: principal, role: (string-ascii 20))`, `has-permission (user: principal, action: (string-ascii 20))`.

8. **ComplianceVerifier.clar**: Provides verification tools for external parties, generating reports on animal history for audits or sales.  
   - Key functions: `generate-report (animal-id: uint)`, `verify-integrity (animal-id: uint)` (checks hashes for tampering).

**For Farmers/Vets**  
- Register an animal via `AnimalRegistry`.  
- Update health/feed/vaccination via respective contracts (e.g., call `record-health-check` with authenticated access).  
- Transfer ownership securely when selling livestock.

**For Regulators/Buyers**  
- Query histories using getter functions (e.g., `get-health-history`).  
- Use `ComplianceVerifier` to confirm data integrity and compliance.

**Deployment and Interaction**  
Deploy the contracts on Stacks using the Clarity CLI. Interact via the Stacks wallet or custom dApp. For example, to register an animal:  
```clarity
(contract-call? .AnimalRegistry register-animal u123 "Holstein" u1692921600 tx-sender)
```
This ensures all records are blockchain-secured, reducing fraud and enabling rapid response to health threats like avian flu through transparent data sharing!