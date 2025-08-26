;; AnimalRegistry.clar
;; Core smart contract for registering and managing livestock animals on the Stacks blockchain.
;; This contract handles unique animal registration, basic metadata storage, duplicate prevention via hashing,
;; ownership verification, and limited updates with immutability in mind.
;; It serves as the foundation for the livestock tracking system, ensuring data integrity.

;; Constants
(define-constant ERR-ALREADY-REGISTERED u100)
(define-constant ERR-UNAUTHORIZED u101)
(define-constant ERR-INVALID-ID u102)
(define-constant ERR-INVALID-PARAM u103)
(define-constant ERR-NOT-FOUND u104)
(define-constant ERR-PAUSED u105)
(define-constant ERR-INVALID-HASH u106)
(define-constant ERR-MAX-TAGS-EXCEEDED u107)
(define-constant ERR-INVALID-STATUS u108)

(define-constant CONTRACT-OWNER tx-sender)
(define-constant MAX-TAGS 10)
(define-constant MAX-DESCRIPTION-LEN u500)
(define-constant MAX-LOCATION-LEN u100)

;; Data Variables
(define-data-var last-animal-id uint u0)
(define-data-var contract-paused bool false)
(define-data-var admin principal CONTRACT-OWNER)

;; Data Maps
(define-map animals
  { animal-id: uint }
  {
    hash: (buff 32), ;; SHA-256 hash of core details for uniqueness
    owner: principal,
    registration-timestamp: uint,
    breed: (string-ascii 50),
    species: (string-ascii 50),
    gender: (string-ascii 10), ;; e.g., "male", "female", "other"
    birth-date: uint, ;; Unix timestamp
    location: (string-utf8 100), ;; Farm or region
    description: (string-utf8 500), ;; Additional notes
    status: (string-ascii 20), ;; e.g., "active", "sold", "deceased"
    tags: (list 10 (string-ascii 20)), ;; Categorization tags
  }
)

(define-map animal-hashes
  { hash: (buff 32) }
  { animal-id: uint }
)

(define-map update-history
  { animal-id: uint, update-id: uint }
  {
    updater: principal,
    timestamp: uint,
    field-updated: (string-ascii 50),
    old-value: (string-utf8 500),
    new-value: (string-utf8 500),
  }
)

(define-map update-counters
  { animal-id: uint }
  { count: uint }
)

;; Private Functions
(define-private (compute-animal-hash (breed (string-ascii 50)) (species (string-ascii 50)) (gender (string-ascii 10)) (birth-date uint) (location (string-utf8 100)))
  ;; Computes a unique hash for duplicate prevention. Note: In real Clarity, use keccak256 or similar; here simulate with buff.
  (keccak256 (fold concat-bytes (list (as-max-len? breed u50) (as-max-len? species u50) (as-max-len? gender u10) (int-to-bytes birth-date) (string-to-bytes location)) 0x))
)

(define-private (int-to-bytes (value uint))
  ;; Helper to convert uint to buff (simplified)
  (unwrap-panic (element-at? (list (unwrap-panic (as-max-len? (int-to-ascii value) u32))) u0))
)

(define-private (concat-bytes (acc (buff 256)) (next (optional (buff 100))))
  (match next val (concat acc val) acc)
)

(define-private (is-admin (caller principal))
  (is-eq caller (var-get admin))
)

(define-private (is-owner (animal-id uint) (caller principal))
  (match (map-get? animals {animal-id: animal-id})
    entry (is-eq (get owner entry) caller)
    false
  )
)

;; Public Functions

(define-public (pause-contract)
  (begin
    (asserts! (is-admin tx-sender) (err ERR-UNAUTHORIZED))
    (var-set contract-paused true)
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-admin tx-sender) (err ERR-UNAUTHORIZED))
    (var-set contract-paused false)
    (ok true)
  )
)

(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-UNAUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)

(define-public (register-animal 
  (breed (string-ascii 50)) 
  (species (string-ascii 50)) 
  (gender (string-ascii 10)) 
  (birth-date uint) 
  (location (string-utf8 100)) 
  (description (string-utf8 500)) 
  (status (string-ascii 20)) 
  (tags (list 10 (string-ascii 20))))
  (let 
    (
      (hash (compute-animal-hash breed species gender birth-date location))
      (existing (map-get? animal-hashes {hash: hash}))
      (new-id (+ (var-get last-animal-id) u1))
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (is-none existing) (err ERR-ALREADY-REGISTERED))
    (asserts! (> (len breed) u0) (err ERR-INVALID-PARAM))
    (asserts! (> (len species) u0) (err ERR-INVALID-PARAM))
    (asserts! (<= (len description) MAX-DESCRIPTION-LEN) (err ERR-INVALID-PARAM))
    (asserts! (<= (len location) MAX-LOCATION-LEN) (err ERR-INVALID-PARAM))
    (asserts! (<= (len tags) MAX-TAGS) (err ERR-MAX-TAGS-EXCEEDED))
    (asserts! (or (is-eq status "active") (is-eq status "pending")) (err ERR-INVALID-STATUS)) ;; Initial statuses only
    (map-set animals
      {animal-id: new-id}
      {
        hash: hash,
        owner: tx-sender,
        registration-timestamp: block-height,
        breed: breed,
        species: species,
        gender: gender,
        birth-date: birth-date,
        location: location,
        description: description,
        status: status,
        tags: tags
      }
    )
    (map-set animal-hashes {hash: hash} {animal-id: new-id})
    (map-set update-counters {animal-id: new-id} {count: u0})
    (var-set last-animal-id new-id)
    (print {event: "animal-registered", animal-id: new-id, owner: tx-sender})
    (ok new-id)
  )
)

(define-public (update-animal-location (animal-id uint) (new-location (string-utf8 100)))
  (let
    (
      (entry (unwrap! (map-get? animals {animal-id: animal-id}) (err ERR-NOT-FOUND)))
      (update-count (+ (get count (unwrap-panic (map-get? update-counters {animal-id: animal-id}))) u1))
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (or (is-owner animal-id tx-sender) (is-admin tx-sender)) (err ERR-UNAUTHORIZED))
    (asserts! (<= (len new-location) MAX-LOCATION-LEN) (err ERR-INVALID-PARAM))
    (map-set animals
      {animal-id: animal-id}
      (merge entry {location: new-location})
    )
    (map-set update-history
      {animal-id: animal-id, update-id: update-count}
      {
        updater: tx-sender,
        timestamp: block-height,
        field-updated: "location",
        old-value: (get location entry),
        new-value: new-location
      }
    )
    (map-set update-counters {animal-id: animal-id} {count: update-count})
    (print {event: "animal-updated", animal-id: animal-id, field: "location"})
    (ok true)
  )
)

(define-public (update-animal-status (animal-id uint) (new-status (string-ascii 20)))
  (let
    (
      (entry (unwrap! (map-get? animals {animal-id: animal-id}) (err ERR-NOT-FOUND)))
      (update-count (+ (get count (unwrap-panic (map-get? update-counters {animal-id: animal-id}))) u1))
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (or (is-owner animal-id tx-sender) (is-admin tx-sender)) (err ERR-UNAUTHORIZED))
    (asserts! (or (is-eq new-status "active") (is-eq new-status "sold") (is-eq new-status "deceased") (is-eq new-status "quarantined")) (err ERR-INVALID-STATUS))
    (map-set animals
      {animal-id: animal-id}
      (merge entry {status: new-status})
    )
    (map-set update-history
      {animal-id: animal-id, update-id: update-count}
      {
        updater: tx-sender,
        timestamp: block-height,
        field-updated: "status",
        old-value: (get status entry),
        new-value: (string-utf8-from-ascii new-status)
      }
    )
    (map-set update-counters {animal-id: animal-id} {count: update-count})
    (print {event: "animal-updated", animal-id: animal-id, field: "status"})
    (ok true)
  )
)

(define-public (transfer-ownership (animal-id uint) (new-owner principal))
  (let
    (
      (entry (unwrap! (map-get? animals {animal-id: animal-id}) (err ERR-NOT-FOUND)))
      (update-count (+ (get count (unwrap-panic (map-get? update-counters {animal-id: animal-id}))) u1))
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (is-owner animal-id tx-sender) (err ERR-UNAUTHORIZED))
    (map-set animals
      {animal-id: animal-id}
      (merge entry {owner: new-owner})
    )
    (map-set update-history
      {animal-id: animal-id, update-id: update-count}
      {
        updater: tx-sender,
        timestamp: block-height,
        field-updated: "owner",
        old-value: (principal-to-string (get owner entry)),
        new-value: (principal-to-string new-owner)
      }
    )
    (map-set update-counters {animal-id: animal-id} {count: update-count})
    (print {event: "ownership-transferred", animal-id: animal-id, old-owner: tx-sender, new-owner: new-owner})
    (ok true)
  )
)

;; Read-Only Functions

(define-read-only (get-animal-details (animal-id uint))
  (map-get? animals {animal-id: animal-id})
)

(define-read-only (get-animal-by-hash (hash (buff 32)))
  (match (map-get? animal-hashes {hash: hash})
    id (get-animal-details (get animal-id id))
    none
  )
)

(define-read-only (verify-ownership (animal-id uint) (owner principal))
  (match (get-animal-details animal-id)
    entry (is-eq (get owner entry) owner)
    false
  )
)

(define-read-only (get-update-history (animal-id uint) (update-id uint))
  (map-get? update-history {animal-id: animal-id, update-id: update-id})
)

(define-read-only (get-update-count (animal-id uint))
  (default-to {count: u0} (map-get? update-counters {animal-id: animal-id}))
)

(define-read-only (is-contract-paused)
  (var-get contract-paused)
)

(define-read-only (get-admin)
  (var-get admin)
)

(define-read-only (get-last-animal-id)
  (var-get last-animal-id)
)