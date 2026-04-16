# POSX Token Sale System — API Spec

## 1. Document Control

- Document Name: `04_API_Spec.md`
- System Name: POSX Token Sale System
- Purpose: Define the API contracts for user frontend, admin panel, and backend integrations
- Audience: Backend engineers, frontend engineers, Cursor, Claude Code, QA
- Depends On:
  - `00_Master_PRD.md`
  - `01_Business_Rules_Spec.md`
  - `02_Backend_Architecture_Spec.md`
  - `03_Database_Schema_Spec.md`
  - `07_State_Machines_And_Exception_Flows.md`

---

## 2. API Design Principles

1. All APIs should be versioned under `/api/v1`.
2. All list APIs must support pagination.
3. All protected APIs must enforce auth server-side.
4. All sensitive admin write APIs must generate audit logs.
5. All business-sensitive calculations must come from backend, not be recomputed on frontend.
6. All responses should be stable, typed, and predictable.
7. All mutation APIs should support idempotency where relevant.
8. UTC timestamps must be returned in ISO 8601 format.
9. Monetary and token amounts should be serialized as strings to preserve precision.
10. Wallet addresses should be returned normalized to lowercase unless display formatting is explicitly needed at UI level.

---

## 3. Common API Conventions

## 3.1 Base Path

`/api/v1`

## 3.2 Response Envelope

All APIs should use a standard envelope.

### Success Response

```json
{
  "success": true,
  "data": {},
  "error_code": null,
  "message": null,
  "request_id": "req_xxx"
}
```

### Error Response

```json
{
  "success": false,
  "data": null,
  "error_code": "INVALID_REQUEST",
  "message": "Invalid request payload",
  "request_id": "req_xxx"
}
```

## 3.3 Pagination Format

List responses should use:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 120,
    "total_pages": 6
  }
}
```

## 3.4 Amount Serialization

All numeric financial values must be returned as strings.

Examples:
- `"1000.000000000000000000"`
- `"0.0618"`

## 3.5 Date and Time

All timestamps returned by APIs must be ISO 8601 UTC strings.

Example:
- `2026-04-13T00:10:00Z`

## 3.6 Authentication Headers

### User APIs
- `Authorization: Bearer <user_session_token>`

### Admin APIs
- `Authorization: Bearer <admin_session_token>`

### Idempotent Mutation APIs
When required:
- `X-Idempotency-Key: <client-generated-key>`

---

## 4. Error Codes

Recommended stable error codes:

### General
- `INVALID_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`
- `SERVICE_UNAVAILABLE`

### Auth
- `NONCE_EXPIRED`
- `NONCE_ALREADY_USED`
- `INVALID_SIGNATURE`
- `SESSION_EXPIRED`
- `ADMIN_DISABLED`

### Purchase
- `PURCHASE_NOT_ALLOWED`
- `MIN_PURCHASE_NOT_MET`
- `INVALID_TX_HASH`
- `PURCHASE_ALREADY_RECOVERED`
- `PURCHASE_DUPLICATE`
- `PURCHASE_NOT_FOUND`

### Claim
- `CLAIM_NOT_ALLOWED`
- `CLAIM_MIN_AMOUNT_NOT_MET`
- `CLAIM_NOTHING_AVAILABLE`
- `CLAIM_ALREADY_IN_PROGRESS`
- `CLAIM_SIGNATURE_REQUIRED`
- `CLAIM_BROADCAST_FAILED`

### Config / Admin
- `INVALID_CONFIG_VALUE`
- `INVALID_CONFIG_SCOPE`
- `ADMIN_ROLE_REQUIRED`
- `RECOMPUTE_APPLY_FORBIDDEN`

### Business Rules
- `REFERRAL_ALREADY_BOUND`
- `INVALID_REFERRAL`
- `SELF_REFERRAL_NOT_ALLOWED`
- `REFERRAL_CYCLE_NOT_ALLOWED`
- `USER_STATUS_RESTRICTED`

---

## 5. Authentication APIs

## 5.1 POST `/api/v1/auth/nonce`

Purpose:
- create a one-time wallet auth nonce for TP Wallet login

Auth:
- public

Request:

```json
{
  "wallet_address": "0xabc123..."
}
```

Response:

```json
{
  "success": true,
  "data": {
    "wallet_address": "0xabc123...",
    "nonce": "random_nonce_string",
    "message_to_sign": "Sign this message to login: random_nonce_string",
    "expires_at": "2026-04-13T10:00:00Z"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_001"
}
```

Validation:
- normalize wallet address to lowercase
- create user row if first seen and product chooses lazy user creation at auth stage

---

## 5.2 POST `/api/v1/auth/verify`

Purpose:
- verify TP Wallet signature and issue session token

Auth:
- public

Request:

```json
{
  "wallet_address": "0xabc123...",
  "nonce": "random_nonce_string",
  "signature": "0xsignedpayload"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "wallet_address": "0xabc123...",
    "session_token": "user_token_xxx",
    "expires_at": "2026-04-20T10:00:00Z",
    "user_status": "active"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_002"
}
```

Errors:
- `NONCE_EXPIRED`
- `NONCE_ALREADY_USED`
- `INVALID_SIGNATURE`

---

## 5.3 POST `/api/v1/auth/logout`

Purpose:
- revoke current user session

Auth:
- user

Request:
- no body

Response:

```json
{
  "success": true,
  "data": {
    "logged_out": true
  },
  "error_code": null,
  "message": null,
  "request_id": "req_003"
}
```

---

## 6. Public Config API

## 6.1 GET `/api/v1/config/public`

Purpose:
- fetch public frontend config needed by user app

Auth:
- public

Response:

```json
{
  "success": true,
  "data": {
    "token_price": "0.0618",
    "min_purchase_amount": "1000",
    "quick_amount_options": ["1000", "5000", "10000", "50000"],
    "reward_min_deposit_threshold": "1000",
    "reward_min_holding_threshold": "1000",
    "min_claim_amount": "10",
    "languages": ["zh-CN", "zh-TW", "en", "ko"],
    "theme_options": ["light", "dark"],
    "announcements": {
      "zh-CN": "...",
      "zh-TW": "...",
      "en": "...",
      "ko": "..."
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_004"
}
```

---

## 7. User Profile and Dashboard APIs

## 7.1 GET `/api/v1/user/profile`

Purpose:
- fetch current authenticated user profile and status

Auth:
- user

Response:

```json
{
  "success": true,
  "data": {
    "wallet_address": "0xabc123...",
    "status": "active",
    "referrer_address": "0xdef456...",
    "referral_bound": true,
    "bound_at": "2026-04-10T12:00:00Z",
    "cumulative_deposit": "12000",
    "holding_posx_amount": "194174.757281553398058252",
    "holding_value_usdt": "12000",
    "current_tier": "advanced",
    "reward_qualified": true,
    "team_reward_qualified": true,
    "direct_rate": "0.10",
    "team_rate": "0.03",
    "created_at": "2026-04-01T00:00:00Z"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_005"
}
```

---

## 7.2 GET `/api/v1/user/dashboard`

Purpose:
- fetch dashboard overview for homepage

Auth:
- user

Response:

```json
{
  "success": true,
  "data": {
    "overview": {
      "cumulative_deposit": "12000",
      "holding_value_usdt": "12000",
      "current_tier": "advanced",
      "locked_posx_total": "194174.757281553398058252",
      "referral_count": 25
    },
    "claimable": {
      "direct_claimable": "0",
      "team_claimable": "300",
      "equal_level_claimable": "120",
      "adjustment_credit_claimable": "20",
      "total_claimable": "440"
    },
    "reward_summary": {
      "direct_total": "500",
      "team_total": "800",
      "equal_level_total": "200",
      "burned_total": "50"
    },
    "burn_status": {
      "burn_enabled": false,
      "holding_value_usdt": "12000",
      "burn_cap": null,
      "used_burn_capacity": null,
      "remaining_burn_capacity": null
    },
    "vesting_summary": {
      "total_locked": "194174.757281553398058252",
      "total_released": "10000",
      "total_withdrawable": "5000",
      "total_withdrawn": "5000"
    },
    "recent_purchases": [
      {
        "purchase_id": "uuid",
        "usdt_amount": "1000",
        "posx_amount": "16181.229773462783171521",
        "token_price_at_purchase": "0.0618",
        "purchase_at": "2026-04-12T10:00:00Z"
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_006"
}
```

---

## 8. Purchase APIs

## 8.1 POST `/api/v1/purchases/orders`

Purpose:
- create purchase order before on-chain execution

Auth:
- user

Headers:
- `X-Idempotency-Key` recommended

Request:

```json
{
  "client_order_id": "client_001",
  "usdt_amount": "1000",
  "expected_token_price": "0.0618",
  "referral_code": "optional_ref_code"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "purchase_order_id": "uuid",
    "wallet_address": "0xabc123...",
    "status": "created",
    "usdt_amount": "1000",
    "expected_token_price": "0.0618",
    "expected_posx_amount": "16181.229773462783171521",
    "min_confirmations": 12,
    "created_at": "2026-04-13T10:00:00Z"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_007"
}
```

Errors:
- `PURCHASE_NOT_ALLOWED`
- `MIN_PURCHASE_NOT_MET`
- `USER_STATUS_RESTRICTED`
- `PURCHASE_DUPLICATE`

---

## 8.2 POST `/api/v1/purchases/orders/{purchase_order_id}/tx`

Purpose:
- attach purchase transaction hash after user submits on-chain tx

Auth:
- user

Request:

```json
{
  "purchase_tx_hash": "0xtxhash",
  "approval_tx_hash": "0xapprovalhash"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "purchase_order_id": "uuid",
    "status": "purchase_pending",
    "purchase_tx_hash": "0xtxhash",
    "approval_tx_hash": "0xapprovalhash"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_008"
}
```

---

## 8.3 GET `/api/v1/purchases/orders/{purchase_order_id}`

Purpose:
- fetch purchase order status

Auth:
- user

Response:

```json
{
  "success": true,
  "data": {
    "purchase_order_id": "uuid",
    "status": "confirmed",
    "wallet_address": "0xabc123...",
    "usdt_amount": "1000",
    "purchase_tx_hash": "0xtxhash",
    "confirmed_purchase_id": "uuid",
    "created_at": "2026-04-13T10:00:00Z",
    "confirmed_at": "2026-04-13T10:05:00Z"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_009"
}
```

---

## 8.4 POST `/api/v1/purchases/recover`

Purpose:
- recover purchase from tx hash when chain success exists but normal linkage failed

Auth:
- user

Request:

```json
{
  "tx_hash": "0xtxhash"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "recovery_id": "uuid",
    "status": "requested",
    "tx_hash": "0xtxhash"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_010"
}
```

Errors:
- `INVALID_TX_HASH`
- `PURCHASE_ALREADY_RECOVERED`

---

## 8.5 GET `/api/v1/purchases`

Purpose:
- list confirmed purchase history for user

Auth:
- user

Query Params:
- `page`
- `page_size`
- `from_date`
- `to_date`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "purchase_id": "uuid",
        "usdt_amount": "1000",
        "posx_amount": "16181.229773462783171521",
        "token_price_at_purchase": "0.0618",
        "tx_hash": "0xtxhash",
        "purchase_at": "2026-04-12T10:00:00Z",
        "is_reversed": false
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_011"
}
```

---

## 9. Vesting APIs

## 9.1 GET `/api/v1/vesting`

Purpose:
- fetch vesting summary and lot list

Auth:
- user

Query Params:
- `page`
- `page_size`

Response:

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_locked": "194174.757281553398058252",
      "total_released": "10000",
      "total_withdrawable": "5000",
      "total_withdrawn": "5000"
    },
    "lots": [
      {
        "vesting_lot_id": "uuid",
        "purchase_id": "uuid",
        "total_locked": "16181.229773462783171521",
        "start_time": "2026-01-01T00:00:00Z",
        "lock_days": 90,
        "release_days": 365,
        "released_amount": "1000",
        "withdrawable_amount": "500",
        "withdrawn_amount": "500",
        "status": "active"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_012"
}
```

---

## 10. Reward APIs

## 10.1 GET `/api/v1/rewards/overview`

Purpose:
- fetch reward overview card data

Auth:
- user

Response:

```json
{
  "success": true,
  "data": {
    "claimable": {
      "team_claimable": "300",
      "equal_level_claimable": "120",
      "adjustment_credit_claimable": "20",
      "total_claimable": "440"
    },
    "totals": {
      "direct_total": "500",
      "team_total": "800",
      "equal_level_total": "200",
      "burned_total": "50"
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_013"
}
```

---

## 10.2 GET `/api/v1/rewards/direct`

Purpose:
- list direct reward history

Auth:
- user

Query Params:
- `page`
- `page_size`
- `from_date`
- `to_date`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "direct_reward_id": "uuid",
        "from_wallet_address": "0x111...",
        "purchase_amount": "1000",
        "reward_rate": "0.05",
        "reward_amount": "50",
        "tx_hash": "0xtxhash",
        "rewarded_at": "2026-04-12T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_014"
}
```

---

## 10.3 GET `/api/v1/rewards/team`

Purpose:
- list daily team reward snapshots

Auth:
- user

Query Params:
- `page`
- `page_size`
- `status`
- `from_date`
- `to_date`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "team_reward_daily_id": "uuid",
        "settle_date": "2026-04-12",
        "qualification_tier": "advanced",
        "user_team_rate": "0.03",
        "team_total_performance": "300000",
        "effective_performance": "10000",
        "raw_total": "300",
        "burned_amount": "0",
        "actual_total": "300",
        "status": "claimable",
        "claim_order_id": null,
        "created_at": "2026-04-13T00:10:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_015"
}
```

---

## 10.4 GET `/api/v1/rewards/team/{team_reward_daily_id}`

Purpose:
- fetch team reward detail including line details

Auth:
- user

Response:

```json
{
  "success": true,
  "data": {
    "team_reward_daily_id": "uuid",
    "settle_date": "2026-04-12",
    "qualification_tier": "advanced",
    "user_team_rate": "0.03",
    "team_total_performance": "300000",
    "effective_performance": "10000",
    "raw_total": "300",
    "burned_amount": "0",
    "actual_total": "300",
    "status": "claimable",
    "line_details": [
      {
        "line_root_wallet_address": "0x222...",
        "line_effective_performance": "5000",
        "subordinate_team_rate": "0.01",
        "differential_rate": "0.02",
        "raw_reward_amount": "100",
        "equal_level_replaced": false
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_016"
}
```

---

## 10.5 GET `/api/v1/rewards/equal-level`

Purpose:
- list equal-level reward snapshots

Auth:
- user

Query Params:
- `page`
- `page_size`
- `status`
- `from_date`
- `to_date`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "equal_level_reward_id": "uuid",
        "settle_date": "2026-04-12",
        "line_root_wallet_address": "0x333...",
        "equal_level_rate": "0.03",
        "subordinate_team_total_performance": "150000",
        "line_effective_performance": "4000",
        "raw_amount": "120",
        "burned_amount": "0",
        "actual_amount": "120",
        "status": "claimable",
        "created_at": "2026-04-13T00:10:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_017"
}
```

---

## 10.6 GET `/api/v1/rewards/burn-status`

Purpose:
- fetch user burn-cap status

Auth:
- user

Response:

```json
{
  "success": true,
  "data": {
    "burn_enabled": true,
    "holding_value_usdt": "8000",
    "burn_disable_threshold": "10000",
    "burn_cap": "8000",
    "used_burn_capacity": "2300",
    "remaining_burn_capacity": "5700",
    "burned_total": "120"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_018"
}
```

---

## 10.7 GET `/api/v1/rewards/claims`

Purpose:
- list claim history

Auth:
- user

Query Params:
- `page`
- `page_size`
- `status`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "claim_record_id": "uuid",
        "claim_order_id": "uuid",
        "amount": "440",
        "tx_hash": "0xclaimhash",
        "status": "confirmed",
        "recorded_at": "2026-04-13T01:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_019"
}
```

---

## 11. Claim APIs

## 11.1 POST `/api/v1/claims`

Purpose:
- create claim order and lock eligible claimable items

Auth:
- user

Headers:
- `X-Idempotency-Key` required

Request:

```json
{
  "client_request_id": "claim_req_001",
  "claim_scope": "claim_all"
}
```

Optional secondary flow:

```json
{
  "client_request_id": "claim_req_002",
  "claim_scope": "claim_by_type",
  "reward_types": ["team", "equal_level"]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "claim_order_id": "uuid",
    "status": "pending_signature",
    "requested_total_amount": "440",
    "items": [
      {
        "reward_type": "team",
        "source_snapshot_id": "uuid",
        "amount": "300"
      },
      {
        "reward_type": "equal_level",
        "source_snapshot_id": "uuid",
        "amount": "120"
      },
      {
        "reward_type": "adjustment_credit",
        "source_snapshot_id": "uuid",
        "amount": "20"
      }
    ],
    "message_to_sign": "Sign to confirm claim order uuid"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_020"
}
```

Errors:
- `CLAIM_NOT_ALLOWED`
- `CLAIM_NOTHING_AVAILABLE`
- `CLAIM_MIN_AMOUNT_NOT_MET`
- `CLAIM_ALREADY_IN_PROGRESS`

---

## 11.2 POST `/api/v1/claims/{claim_order_id}/sign`

Purpose:
- submit TP Wallet signature for claim confirmation

Auth:
- user

Request:

```json
{
  "signature": "0xsignature"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "claim_order_id": "uuid",
    "status": "queued",
    "requested_total_amount": "440",
    "queued_at": "2026-04-13T00:50:00Z"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_021"
}
```

Errors:
- `INVALID_SIGNATURE`
- `CLAIM_SIGNATURE_REQUIRED`

---

## 11.3 GET `/api/v1/claims/{claim_order_id}`

Purpose:
- fetch claim order status

Auth:
- user

Response:

```json
{
  "success": true,
  "data": {
    "claim_order_id": "uuid",
    "wallet_address": "0xabc123...",
    "status": "broadcasted",
    "requested_total_amount": "440",
    "broadcast_tx_hash": "0xclaimhash",
    "created_at": "2026-04-13T00:45:00Z",
    "signed_at": "2026-04-13T00:49:00Z",
    "queued_at": "2026-04-13T00:50:00Z",
    "broadcasted_at": "2026-04-13T00:51:00Z",
    "confirmed_at": null,
    "failure_reason": null
  },
  "error_code": null,
  "message": null,
  "request_id": "req_022"
}
```

---

## 12. Team and Invite APIs

## 12.1 GET `/api/v1/team/overview`

Purpose:
- fetch user team overview cards

Auth:
- user

Response:

```json
{
  "success": true,
  "data": {
    "team_total_performance": "300000",
    "today_effective_performance": "10000",
    "claimable_amount": "420",
    "pending_confirmation_amount": "50",
    "total_received": "1000",
    "total_claimed": "580",
    "current_team_rate": "0.03",
    "current_tier": "advanced",
    "next_rate_target": {
      "next_rate": "0.05",
      "required_team_total_performance": "500001",
      "remaining_needed": "200001"
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_023"
}
```

---

## 12.2 GET `/api/v1/team/members`

Purpose:
- list team members with privacy-aware visibility rules

Auth:
- user

Query Params:
- `page`
- `page_size`
- `level`
- `search`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "wallet_address_masked": "0x12ab...89ef",
        "level": 1,
        "joined_at": "2026-04-01T10:00:00Z",
        "cumulative_deposit": "3000",
        "current_tier": "basic",
        "direct_referral_count": 5,
        "status": "active"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    },
    "aggregates_by_level": [
      {
        "level": 2,
        "member_count": 10,
        "active_count": 7,
        "new_performance": "2000",
        "cumulative_performance": "15000"
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_024"
}
```

---

## 12.3 GET `/api/v1/team/daily-details`

Purpose:
- list daily team reward details including pending confirmation and settled days

Auth:
- user

Query Params:
- `page`
- `page_size`
- `from_date`
- `to_date`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "date": "2026-04-12",
        "effective_performance": "10000",
        "team_rate": "0.03",
        "team_raw_amount": "300",
        "equal_level_raw_amount": "120",
        "burned_amount": "0",
        "actual_amount": "420",
        "status": "settled"
      },
      {
        "date": "2026-04-13",
        "effective_performance": "2000",
        "team_rate": "0.03",
        "team_raw_amount": "60",
        "equal_level_raw_amount": "0",
        "burned_amount": "0",
        "actual_amount": "60",
        "status": "pending_confirmation"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 2,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_025"
}
```

---

## 12.4 GET `/api/v1/invite`

Purpose:
- fetch invite data for invite page

Auth:
- user

Response:

```json
{
  "success": true,
  "data": {
    "invite_unlocked": true,
    "unlock_threshold": "1000",
    "current_cumulative_deposit": "12000",
    "invite_link": "https://example.com?r=abc123",
    "referral_code": "abc123",
    "referral_count": 25,
    "referral_stats": {
      "total_referral_deposit": "50000",
      "active_referral_count": 18
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_026"
}
```

---

## 12.5 GET `/api/v1/invite/referrals`

Purpose:
- list direct referrals

Auth:
- user

Query Params:
- `page`
- `page_size`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "wallet_address_masked": "0x55aa...22ff",
        "bound_at": "2026-04-01T10:00:00Z",
        "cumulative_deposit": "3000",
        "current_tier": "basic",
        "status": "active"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_027"
}
```

---

## 13. Admin Auth APIs

## 13.1 POST `/api/v1/admin/auth/login`

Purpose:
- admin login

Auth:
- public

Request:

```json
{
  "email": "admin@example.com",
  "password": "plaintext-or-client-handled"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "admin_user_id": "uuid",
    "name": "Admin",
    "role": "super_admin",
    "session_token": "admin_token_xxx",
    "expires_at": "2026-04-20T10:00:00Z"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_028"
}
```

---

## 13.2 POST `/api/v1/admin/auth/logout`

Purpose:
- revoke admin session

Auth:
- admin

Response:

```json
{
  "success": true,
  "data": {
    "logged_out": true
  },
  "error_code": null,
  "message": null,
  "request_id": "req_029"
}
```

---

## 14. Admin Dashboard APIs

## 14.1 GET `/api/v1/admin/dashboard`

Purpose:
- fetch admin dashboard overview

Auth:
- admin

Query Params:
- `range` = `day|week|month|custom`
- `from_date`
- `to_date`

Response:

```json
{
  "success": true,
  "data": {
    "summary": {
      "platform_total_deposit": "1000000",
      "today_deposit": "20000",
      "total_users": 1200,
      "today_new_users": 30,
      "total_locked_posx": "5000000",
      "total_released_posx": "1500000",
      "reward_24h": {
        "direct": "5000",
        "team": "3000",
        "equal_level": "1200"
      },
      "burn_total": "800"
    },
    "trend": [
      {
        "date": "2026-04-12",
        "deposit_total": "18000",
        "new_users_count": 25,
        "reward_total": "3500"
      }
    ],
    "tier_distribution": [
      {
        "tier": "basic",
        "count": 500
      },
      {
        "tier": "advanced",
        "count": 300
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_030"
}
```

---

## 15. Admin User Management APIs

## 15.1 GET `/api/v1/admin/users`

Purpose:
- list users with filters

Auth:
- admin

Query Params:
- `page`
- `page_size`
- `search`
- `status`
- `tier`
- `min_deposit`
- `max_deposit`
- `from_date`
- `to_date`
- `sort_by`
- `sort_order`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "wallet_address": "0xabc123...",
        "status": "active",
        "cumulative_deposit": "12000",
        "holding_value_usdt": "12000",
        "current_tier": "advanced",
        "referrer_address": "0xdef456...",
        "direct_referral_count": 25,
        "team_total_performance": "300000",
        "created_at": "2026-04-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_031"
}
```

---

## 15.2 GET `/api/v1/admin/users/{wallet_address}`

Purpose:
- fetch admin detail view for a user

Auth:
- admin

Response:

```json
{
  "success": true,
  "data": {
    "identity": {
      "wallet_address": "0xabc123...",
      "status": "active",
      "created_at": "2026-04-01T00:00:00Z",
      "first_purchase_at": "2026-04-02T00:00:00Z"
    },
    "referral": {
      "referrer_address": "0xdef456...",
      "bound_at": "2026-04-02T00:00:00Z",
      "binding_source": "referral_link",
      "direct_referral_count": 25
    },
    "financial": {
      "cumulative_deposit": "12000",
      "holding_posx_amount": "194174.757281553398058252",
      "holding_value_usdt": "12000",
      "current_tier": "advanced",
      "reward_qualified": true,
      "team_reward_qualified": true,
      "team_total_performance": "300000"
    },
    "reward_summary": {
      "direct_total": "500",
      "team_total": "800",
      "equal_level_total": "200",
      "claimable_total": "440",
      "burned_total": "50"
    },
    "vesting_summary": {
      "total_locked": "194174.757281553398058252",
      "total_released": "10000",
      "total_withdrawable": "5000",
      "total_withdrawn": "5000"
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_032"
}
```

---

## 15.3 PATCH `/api/v1/admin/users/{wallet_address}/status`

Purpose:
- update user operational status

Auth:
- admin

Required Role:
- `operator` or above, depending on policy

Request:

```json
{
  "target_status": "restricted_claim",
  "reason": "Risk review",
  "effective_from": "2026-04-13T12:00:00Z",
  "note": "Temporary hold while reviewing claim activity"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "wallet_address": "0xabc123...",
    "old_status": "active",
    "new_status": "restricted_claim",
    "effective_from": "2026-04-13T12:00:00Z",
    "updated_by": "uuid"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_033"
}
```

Errors:
- `ADMIN_ROLE_REQUIRED`
- `USER_STATUS_RESTRICTED`

---

## 15.4 GET `/api/v1/admin/users/{wallet_address}/tree`

Purpose:
- fetch referral tree for admin

Auth:
- admin

Query Params:
- `max_depth`
- `include_metrics` = `true|false`

Response:

```json
{
  "success": true,
  "data": {
    "root_wallet_address": "0xabc123...",
    "nodes": [
      {
        "wallet_address": "0xchild1...",
        "parent_wallet_address": "0xabc123...",
        "depth": 1,
        "status": "active",
        "cumulative_deposit": "3000",
        "current_tier": "basic"
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_034"
}
```

---

## 16. Admin Reward APIs

## 16.1 GET `/api/v1/admin/rewards/direct`

Purpose:
- list direct reward records

Auth:
- admin

Query Params:
- `page`
- `page_size`
- `wallet_address`
- `from_wallet_address`
- `from_date`
- `to_date`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "direct_reward_id": "uuid",
        "from_wallet_address": "0x111...",
        "to_wallet_address": "0x222...",
        "purchase_amount": "1000",
        "reward_rate": "0.05",
        "reward_amount": "50",
        "tx_hash": "0xtxhash",
        "rewarded_at": "2026-04-12T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_035"
}
```

---

## 16.2 GET `/api/v1/admin/rewards/team`

Purpose:
- list team reward daily snapshots

Auth:
- admin

Query Params:
- `page`
- `page_size`
- `wallet_address`
- `settle_date`
- `status`
- `from_date`
- `to_date`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "team_reward_daily_id": "uuid",
        "wallet_address": "0xabc123...",
        "settle_date": "2026-04-12",
        "qualification_tier": "advanced",
        "user_team_rate": "0.03",
        "team_total_performance": "300000",
        "effective_performance": "10000",
        "raw_total": "300",
        "burned_amount": "0",
        "actual_total": "300",
        "status": "claimable"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_036"
}
```

---

## 16.3 GET `/api/v1/admin/rewards/team/{team_reward_daily_id}`

Purpose:
- fetch team reward detail with line breakdown

Auth:
- admin

Response:

```json
{
  "success": true,
  "data": {
    "team_reward_daily_id": "uuid",
    "wallet_address": "0xabc123...",
    "settle_date": "2026-04-12",
    "raw_total": "300",
    "burned_amount": "0",
    "actual_total": "300",
    "status": "claimable",
    "line_details": [
      {
        "line_root_wallet_address": "0xchild1...",
        "line_effective_performance": "5000",
        "subordinate_team_rate": "0.01",
        "differential_rate": "0.02",
        "raw_reward_amount": "100",
        "equal_level_replaced": false
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_037"
}
```

---

## 16.4 GET `/api/v1/admin/rewards/equal-level`

Purpose:
- list equal-level reward snapshots

Auth:
- admin

Query Params:
- `page`
- `page_size`
- `wallet_address`
- `line_root_wallet_address`
- `settle_date`
- `status`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "equal_level_reward_id": "uuid",
        "wallet_address": "0xabc123...",
        "line_root_wallet_address": "0xchild2...",
        "settle_date": "2026-04-12",
        "equal_level_rate": "0.03",
        "line_effective_performance": "4000",
        "raw_amount": "120",
        "burned_amount": "0",
        "actual_amount": "120",
        "status": "claimable"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_038"
}
```

---

## 16.5 GET `/api/v1/admin/rewards/burns`

Purpose:
- list burn records

Auth:
- admin

Query Params:
- `page`
- `page_size`
- `wallet_address`
- `reward_type`
- `from_date`
- `to_date`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "burn_record_id": "uuid",
        "wallet_address": "0xabc123...",
        "reward_type": "team",
        "settle_date": "2026-04-12",
        "holding_value_at_snapshot": "8000",
        "used_burn_capacity_before": "2300",
        "burn_cap": "8000",
        "raw_amount": "500",
        "burned_amount": "120",
        "actual_amount": "380",
        "reason": "burn_cap_exceeded"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_039"
}
```

---

## 17. Admin Config APIs

## 17.1 GET `/api/v1/admin/config`

Purpose:
- fetch config groups and current effective versions

Auth:
- admin

Query Params:
- `config_group`
- `config_key`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "config_version_id": "uuid",
        "config_group": "pricing",
        "config_key": "token_price",
        "version_no": 3,
        "config_value": {
          "token_price": "0.0618"
        },
        "effective_from": "2026-04-14T00:00:00Z",
        "apply_scope": "next_settlement_day",
        "status": "active",
        "description": "Daily token sale price"
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_040"
}
```

---

## 17.2 POST `/api/v1/admin/config`

Purpose:
- create new config version

Auth:
- admin

Required Role:
- `operator` or above

Request:

```json
{
  "config_group": "pricing",
  "config_key": "token_price",
  "config_value": {
    "token_price": "0.0650"
  },
  "effective_from": "2026-04-14T00:00:00Z",
  "apply_scope": "next_settlement_day",
  "description": "Token price update"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "config_version_id": "uuid",
    "config_group": "pricing",
    "config_key": "token_price",
    "version_no": 4,
    "effective_from": "2026-04-14T00:00:00Z",
    "apply_scope": "next_settlement_day",
    "status": "active"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_041"
}
```

Errors:
- `INVALID_CONFIG_VALUE`
- `INVALID_CONFIG_SCOPE`

---

## 17.3 GET `/api/v1/admin/config/history`

Purpose:
- fetch config change history

Auth:
- admin

Query Params:
- `config_group`
- `config_key`
- `page`
- `page_size`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "config_change_history_id": "uuid",
        "config_version_id": "uuid",
        "config_group": "pricing",
        "config_key": "token_price",
        "old_value": {
          "token_price": "0.0618"
        },
        "new_value": {
          "token_price": "0.0650"
        },
        "effective_from": "2026-04-14T00:00:00Z",
        "apply_scope": "next_settlement_day",
        "changed_by_admin_id": "uuid",
        "changed_at": "2026-04-13T12:00:00Z",
        "change_note": "Token price update"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_042"
}
```

---

## 18. Admin Settlement and Recompute APIs

## 18.1 POST `/api/v1/admin/settlement/trigger`

Purpose:
- manually trigger settlement or backfill

Auth:
- admin

Required Role:
- `operator` or above

Request:

```json
{
  "settlement_date": "2026-04-12",
  "mode": "backfill",
  "reason": "Missed scheduled run"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "settlement_job_id": "uuid",
    "job_type": "backfill",
    "settlement_date": "2026-04-12",
    "status": "running"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_043"
}
```

---

## 18.2 POST `/api/v1/admin/recompute/preview`

Purpose:
- run recompute preview without mutating official financial records

Auth:
- admin

Required Role:
- `operator` or above

Request:

```json
{
  "settlement_date": "2026-04-12",
  "reason": "Validation after bug fix"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "settlement_job_id": "uuid",
    "mode": "recompute_preview",
    "status": "completed",
    "summary": {
      "processed_user_count": 120,
      "difference_count": 8,
      "positive_difference_total": "150",
      "negative_difference_total": "60"
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_044"
}
```

---

## 18.3 POST `/api/v1/admin/recompute/apply`

Purpose:
- apply adjustment-based correction from recompute

Auth:
- admin

Required Role:
- `super_admin`

Request:

```json
{
  "settlement_date": "2026-04-12",
  "reason": "Apply corrections after validated bug fix"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "settlement_job_id": "uuid",
    "mode": "recompute_apply_adjustment",
    "status": "running"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_045"
}
```

Errors:
- `RECOMPUTE_APPLY_FORBIDDEN`

---

## 18.4 GET `/api/v1/admin/settlement/jobs`

Purpose:
- list settlement/recompute jobs

Auth:
- admin

Query Params:
- `page`
- `page_size`
- `settlement_date`
- `job_type`
- `status`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "settlement_job_id": "uuid",
        "job_type": "daily_settlement",
        "mode": "official",
        "settlement_date": "2026-04-12",
        "status": "completed",
        "processed_user_count": 120,
        "created_snapshot_count": 150,
        "created_adjustment_count": 0,
        "error_count": 0,
        "started_at": "2026-04-13T00:10:00Z",
        "finished_at": "2026-04-13T00:12:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_046"
}
```

---

## 18.5 GET `/api/v1/admin/settlement/jobs/{settlement_job_id}`

Purpose:
- fetch job detail

Auth:
- admin

Response:

```json
{
  "success": true,
  "data": {
    "settlement_job_id": "uuid",
    "job_type": "recompute",
    "mode": "recompute_preview",
    "settlement_date": "2026-04-12",
    "status": "completed",
    "config_version_snapshot": {
      "pricing": 3,
      "team_rules": 5
    },
    "processed_user_count": 120,
    "created_snapshot_count": 0,
    "created_adjustment_count": 0,
    "error_count": 0,
    "error_sample": null,
    "started_at": "2026-04-13T02:00:00Z",
    "finished_at": "2026-04-13T02:05:00Z",
    "reason": "Validation after bug fix"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_047"
}
```

---

## 19. Admin Reporting APIs

## 19.1 GET `/api/v1/admin/reports/summary`

Purpose:
- fetch report summary metrics for selected range

Auth:
- admin

Query Params:
- `from_date`
- `to_date`
- `granularity` = `day|week|month`

Response:

```json
{
  "success": true,
  "data": {
    "totals": {
      "deposit_total": "1000000",
      "direct_reward_total": "50000",
      "team_reward_total": "30000",
      "equal_level_reward_total": "12000",
      "burn_total": "8000",
      "claim_total": "70000"
    },
    "series": [
      {
        "date": "2026-04-12",
        "deposit_total": "20000",
        "team_reward_total": "3000"
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_048"
}
```

---

## 19.2 GET `/api/v1/admin/reports/rankings/team`

Purpose:
- fetch team performance ranking

Auth:
- admin

Query Params:
- `limit`
- `snapshot_date`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "wallet_address": "0xabc123...",
        "team_total_performance": "1000000",
        "current_tier": "elite",
        "team_rate": "0.15"
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_049"
}
```

---

## 19.3 POST `/api/v1/admin/reports/export`

Purpose:
- create report export job

Auth:
- admin

Request:

```json
{
  "report_type": "reward_issuance",
  "filters": {
    "from_date": "2026-04-01",
    "to_date": "2026-04-12"
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "report_export_job_id": "uuid",
    "status": "queued"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_050"
}
```

---

## 19.4 GET `/api/v1/admin/reports/export/{report_export_job_id}`

Purpose:
- fetch export job status and file path if completed

Auth:
- admin

Response:

```json
{
  "success": true,
  "data": {
    "report_export_job_id": "uuid",
    "status": "completed",
    "file_path": "/exports/report_001.csv",
    "error_message": null,
    "created_at": "2026-04-13T03:00:00Z",
    "finished_at": "2026-04-13T03:01:00Z"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_051"
}
```

---

## 20. Admin System APIs

## 20.1 GET `/api/v1/admin/system/chain-sync`

Purpose:
- fetch chain sync status

Auth:
- admin

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "chain_id": 1,
        "contract_address": "0xcontract...",
        "sync_key": "main_purchase_contract",
        "last_scanned_block": 12345678,
        "last_confirmed_block": 12345660,
        "last_scanned_at": "2026-04-13T03:00:00Z",
        "updated_at": "2026-04-13T03:00:00Z"
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_052"
}
```

---

## 20.2 GET `/api/v1/admin/system/jobs`

Purpose:
- fetch job run history

Auth:
- admin

Query Params:
- `page`
- `page_size`
- `job_name`
- `status`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "job_run_id": "uuid",
        "job_name": "settle_team_rewards",
        "status": "completed",
        "started_at": "2026-04-13T00:10:00Z",
        "finished_at": "2026-04-13T00:12:00Z",
        "rows_scanned": 1200,
        "rows_processed": 120,
        "rows_failed": 0,
        "error_message": null
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_053"
}
```

---

## 20.3 GET `/api/v1/admin/system/health`

Purpose:
- fetch current health summary

Auth:
- admin

Response:

```json
{
  "success": true,
  "data": {
    "checks": [
      {
        "health_key": "database",
        "status": "ok",
        "checked_at": "2026-04-13T03:00:00Z",
        "detail": {}
      },
      {
        "health_key": "chain_sync",
        "status": "warn",
        "checked_at": "2026-04-13T03:00:00Z",
        "detail": {
          "lag_blocks": 18
        }
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_054"
}
```

---

## 20.4 GET `/api/v1/admin/logs`

Purpose:
- fetch admin audit logs

Auth:
- admin

Query Params:
- `page`
- `page_size`
- `admin_user_id`
- `action`
- `target_type`
- `from_date`
- `to_date`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "admin_log_id": "uuid",
        "admin_user_id": "uuid",
        "action": "update_user_status",
        "target_type": "user",
        "target_id": "0xabc123...",
        "detail": {
          "old_status": "active",
          "new_status": "restricted_claim"
        },
        "ip_address": "127.0.0.1",
        "created_at": "2026-04-13T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  },
  "error_code": null,
  "message": null,
  "request_id": "req_055"
}
```

---

## 21. Admin Account APIs

## 21.1 GET `/api/v1/admin/accounts`

Purpose:
- list admin accounts

Auth:
- admin

Required Role:
- `super_admin`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "admin_user_id": "uuid",
        "email": "admin@example.com",
        "name": "Admin",
        "role": "super_admin",
        "status": "active",
        "last_login_at": "2026-04-13T02:00:00Z",
        "created_at": "2026-04-01T00:00:00Z"
      }
    ]
  },
  "error_code": null,
  "message": null,
  "request_id": "req_056"
}
```

---

## 21.2 POST `/api/v1/admin/accounts`

Purpose:
- create admin account

Auth:
- admin

Required Role:
- `super_admin`

Request:

```json
{
  "email": "operator@example.com",
  "password": "strong_password",
  "name": "Operator",
  "role": "operator"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "admin_user_id": "uuid",
    "email": "operator@example.com",
    "name": "Operator",
    "role": "operator",
    "status": "active"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_057"
}
```

---

## 21.3 PATCH `/api/v1/admin/accounts/{admin_user_id}`

Purpose:
- update admin role or status

Auth:
- admin

Required Role:
- `super_admin`

Request:

```json
{
  "role": "viewer",
  "status": "active",
  "name": "Updated Name"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "admin_user_id": "uuid",
    "role": "viewer",
    "status": "active",
    "name": "Updated Name"
  },
  "error_code": null,
  "message": null,
  "request_id": "req_058"
}
```

---

## 22. Internal/Worker-Oriented APIs or Service Contracts

These do not need public HTTP exposure if implemented as internal modules, but the codebase should define typed contracts for:

- chain event scan batch request
- chain confirmation update batch
- settlement job trigger payload
- summary rebuild payload
- report export job runner payload
- claim broadcast retry payload

Example internal job payload:

```json
{
  "job_name": "daily_settlement",
  "settlement_date": "2026-04-12",
  "mode": "official",
  "triggered_by_admin_id": null
}
```

---

## 23. API Permission Matrix Summary

### Public
- `POST /auth/nonce`
- `POST /auth/verify`
- `GET /config/public`

### User Auth Required
- `/user/profile`
- `/user/dashboard`
- `/purchases/...`
- `/vesting`
- `/rewards/...`
- `/claims/...`
- `/team/...`
- `/invite...`
- `/auth/logout`

### Admin Auth Required
- `/admin/...`

### Super Admin Only
- `/admin/recompute/apply`
- `/admin/accounts` mutations
- selected high-risk operations by implementation policy

---

## 24. Idempotency Requirements Summary

Mutation APIs that should support idempotency:

1. `POST /api/v1/purchases/orders`
   - key basis: wallet + client_order_id

2. `POST /api/v1/claims`
   - key basis: wallet + client_request_id

3. config creation may optionally use idempotency for admin tooling
4. recompute/apply trigger may optionally use idempotency for admin tooling

---

## 25. API Acceptance Checklist

The API layer is acceptable when all are true:

1. every frontend page can be implemented using the defined endpoints
2. all financial amounts are returned as strings
3. auth, purchase, reward, claim, team, invite, admin, config, system, and reporting flows are covered
4. admin mutation APIs are permission-aware
5. list APIs have pagination
6. claim and purchase mutations support idempotency
7. APIs expose backend-calculated values instead of requiring frontend formula logic
8. error codes are stable and usable for i18n mapping

---

## 26. Next Documents

The next implementation documents should be:

- `05_User_Frontend_PRD.md`
- `06_Admin_Panel_PRD.md`
- `07_State_Machines_And_Exception_Flows.md`

These will map the API contracts into page behavior and lifecycle state rules.

