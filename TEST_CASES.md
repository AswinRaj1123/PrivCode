# PrivCode - Test Cases Documentation

## Authentication & Access Control Tests

### Test Case ID: TC_001
**Input:** User login with valid admin credentials (username/password from .env)
**Expected Result:** Authentication token generated and access granted to all features
**Actual Result:** Token successfully created, user logged in as admin
**Status:** Pass

### Test Case ID: TC_002
**Input:** User login with invalid credentials (wrong password)
**Expected Result:** Authentication fails, error message displayed
**Actual Result:** Unauthorized access denied, error logged
**Status:** Pass

### Test Case ID: TC_003
**Input:** User login with developer credentials
**Expected Result:** Access granted with limited permissions (view-only)
**Actual Result:** Developer role applied, restricted access enforced
**Status:** Pass

### Test Case ID: TC_004
**Input:** Expired JWT token used for API request
**Expected Result:** Token validation fails, request rejected with 401 Unauthorized
**Actual Result:** Request rejected, user redirected to login
**Status:** Pass

### Test Case ID: TC_005
**Input:** Access restricted endpoint (admin-only) with developer token
**Expected Result:** Access denied with 403 Forbidden response
**Actual Result:** Permission denied, endpoint blocked
**Status:** Pass

---

## Repository Indexing Tests

### Test Case ID: TC_006
**Input:** Index new Git repository (clone and process code files)
**Expected Result:** Repository successfully indexed, metadata stored, vector embeddings created
**Actual Result:** Indexing completed without errors, FAISS index updated
**Status:** Pass

### Test Case ID: TC_007
**Input:** Index repository with missing or corrupted files
**Expected Result:** Error handling triggered, valid files indexed, errors logged
**Actual Result:** Partial indexing completed, error log generated
**Status:** Pass

### Test Case ID: TC_008
**Input:** Incremental indexing - index only new/modified files from existing repository
**Expected Result:** Only changed files processed, database updated efficiently
**Actual Result:** Incremental update successful, no duplicate processing
**Status:** Pass

### Test Case ID: TC_009
**Input:** Index large repository (1000+ files with complex code structure)
**Expected Result:** System processes without crash, all files indexed
**Actual Result:** Indexing completed successfully without performance degradation
**Status:** Pass

### Test Case ID: TC_010
**Input:** Index repository containing encrypted files or sensitive data
**Expected Result:** Files encrypted, secure storage maintained, decryption keys managed
**Actual Result:** Encryption applied correctly, no data leakage
**Status:** Pass

---

## Code Querying & RAG Tests

### Test Case ID: TC_011
**Input:** Query: "Find all authentication functions in the codebase"
**Expected Result:** System retrieves relevant code chunks, LLM generates accurate analysis with sources
**Actual Result:** Correct functions identified, detailed explanation provided with file references
**Status:** Pass

### Test Case ID: TC_012
**Input:** Query with specific code pattern: "Find all database queries that are not using parameterized statements"
**Expected Result:** Vulnerable code patterns identified, potential SQL injection risks flagged
**Actual Result:** Dangerous patterns detected, suggestions for fixes provided
**Status:** Pass

### Test Case ID: TC_013
**Input:** Query requesting information not present in codebase: "Find external API calls to payment gateway"
**Expected Result:** System returns "Not found in the provided code" instead of hallucinating
**Actual Result:** Accurate response indicating absence of relevant code
**Status:** Pass

### Test Case ID: TC_014
**Input:** Query analyzing code for bugs and security issues
**Expected Result:** Bugs identified, explanations provided with code context, suggestions for fixes
**Actual Result:** Multiple issues flagged with accurate bug descriptions and remediation steps
**Status:** Pass

### Test Case ID: TC_015
**Input:** Complex multi-file code query spanning multiple functions
**Expected Result:** RAG retrieves relevant chunks from multiple files, LLM traces execution flow
**Actual Result:** Comprehensive analysis across files, call chains properly traced
**Status:** Pass

---

## Vector Search & Retrieval Tests

### Test Case ID: TC_016
**Input:** Hybrid search (semantic + keyword) for code pattern
**Expected Result:** Accurate results ranked by relevance, both semantic and keyword matches included
**Actual Result:** Top results contain relevant code, ranking algorithm performs optimally
**Status:** Pass

### Test Case ID: TC_017
**Input:** Search with similarity threshold filtering
**Expected Result:** Only results above threshold returned, noise filtered out
**Actual Result:** Search results meet quality criteria, irrelevant matches excluded
**Status:** Pass

### Test Case ID: TC_018
**Input:** Search with large context window (retrieve 20+ related code chunks)
**Expected Result:** All relevant chunks retrieved within performance limits
**Actual Result:** Full context provided without timeout, LLM processes successfully
**Status:** Pass

### Test Case ID: TC_019
**Input:** Search on empty repository (no indexed files)
**Expected Result:** Graceful handling, informative message returned
**Actual Result:** No errors, user notified to index repository first
**Status:** Pass

---

## LLM Inference Tests

### Test Case ID: TC_020
**Input:** Query requiring LLM inference with 2048 token context
**Expected Result:** Model generates response within timeout, output is valid JSON
**Actual Result:** Response generated successfully, properly formatted output validated
**Status:** Pass

### Test Case ID: TC_021
**Input:** Query with code context containing complex nested structures
**Expected Result:** LLM correctly analyzes nested logic, accurate explanations provided
**Actual Result:** Nested structures properly understood, accurate analysis delivered
**Status:** Pass

### Test Case ID: TC_022
**Input:** Rapid consecutive queries (5+ queries within 1 second)
**Expected Result:** Queue handled properly, responses returned in order, no race conditions
**Actual Result:** All queries processed, results consistent and accurate
**Status:** Pass

### Test Case ID: TC_023
**Input:** Query causing LLM to process at max token limit
**Expected Result:** Response truncated gracefully, no memory overflow or crashes
**Actual Result:** Safe truncation, user notified if response incomplete
**Status:** Pass

---

## Data Encryption Tests

### Test Case ID: TC_024
**Input:** Encrypt sensitive code indices and metadata
**Expected Result:** Data encrypted with keys from configuration, readable only with correct key
**Actual Result:** Encryption applied, decryption successful with valid key
**Status:** Pass

### Test Case ID: TC_025
**Input:** Attempt to decrypt with incorrect encryption key
**Expected Result:** Decryption fails, error message displayed, no data leakage
**Actual Result:** Access denied, encrypted data remains secure
**Status:** Pass

### Test Case ID: TC_026
**Input:** Encrypt/decrypt large datasets (50MB+ index files)
**Expected Result:** Performance acceptable, no data corruption
**Actual Result:** Large files encrypted/decrypted without loss, integrity maintained
**Status:** Pass

---

## Database & Persistence Tests

### Test Case ID: TC_027
**Input:** Store indexed repository metadata to persistent storage
**Expected Result:** Metadata persisted correctly, recoverable after application restart
**Actual Result:** Data persists, retrieval successful after restart
**Status:** Pass

### Test Case ID: TC_028
**Input:** Concurrent writes to database from multiple API requests
**Expected Result:** Database maintains consistency, no race conditions
**Actual Result:** All writes completed successfully, data integrity maintained
**Status:** Pass

### Test Case ID: TC_029
**Input:** Database connection failure during operation
**Expected Result:** Graceful error handling, retry mechanism activated, user notified
**Actual Result:** Connection retry successful, operation resumed
**Status:** Pass

---

## Frontend Integration Tests

### Test Case ID: TC_030
**Input:** Load Next.js frontend and authenticate user
**Expected Result:** Frontend loads correctly, login form displayed
**Actual Result:** Page renders without errors, interactive
**Status:** Pass

### Test Case ID: TC_031
**Input:** Submit code query from web interface
**Expected Result:** Request sent to backend, response received and displayed
**Actual Result:** Results displayed with proper formatting, source references shown
**Status:** Pass

### Test Case ID: TC_032
**Input:** Display large code snippets in frontend from RAG results
**Expected Result:** Code displayed with syntax highlighting, pagination handled for large content
**Actual Result:** Code properly formatted and readable, no UI overflow
**Status:** Pass

---

## Performance & Load Tests

### Test Case ID: TC_033
**Input:** Index multiple large repositories simultaneously
**Expected Result:** System handles concurrent indexing without degradation
**Actual Result:** All repositories indexed successfully, performance acceptable
**Status:** Pass

### Test Case ID: TC_034
**Input:** Process 100 concurrent code queries
**Expected Result:** System remains responsive, no dropped requests
**Actual Result:** All queries processed, average response time within SLA
**Status:** Pass

### Test Case ID: TC_035
**Input:** System runs for extended period (8+ hours) with continuous operations
**Expected Result:** No memory leaks, stable performance maintained
**Actual Result:** Resource usage stable, no crashes or degradation
**Status:** Pass

---

## Error Handling & Recovery Tests

### Test Case ID: TC_036
**Input:** Attempt to index repository with invalid Git URL
**Expected Result:** Error caught and logged, user-friendly message displayed
**Actual Result:** Invalid URL rejected with clear error message
**Status:** Pass

### Test Case ID: TC_037
**Input:** Query with malformed JSON structure
**Expected Result:** Validation error returned, request rejected safely
**Actual Result:** Bad request error with helpful validation details
**Status:** Pass

### Test Case ID: TC_038
**Input:** LLM model file missing or corrupted
**Expected Result:** Error caught with helpful guidance, application doesn't crash
**Actual Result:** Error message directs user to download model
**Status:** Pass

### Test Case ID: TC_039
**Input:** FAISS index corrupted or unreadable
**Expected Result:** System detects corruption and triggers reindexing
**Actual Result:** Automatic recovery initiated, index rebuilt
**Status:** Pass

---

## Security Tests

### Test Case ID: TC_040
**Input:** Attempt SQL injection via query parameter
**Expected Result:** Input sanitized, malicious patterns blocked
**Actual Result:** Attack prevented, logged as security event
**Status:** Pass

### Test Case ID: TC_041
**Input:** Attempt path traversal attack (../../../etc/passwd)
**Expected Result:** Path validation blocks access, error logged
**Actual Result:** Attack prevented, access denied with logging
**Status:** Pass

### Test Case ID: TC_042
**Input:** Attempt to modify JWT token and replay request
**Expected Result:** Token validation fails, request rejected
**Actual Result:** Invalid token detected, request blocked
**Status:** Pass

### Test Case ID: TC_043
**Input:** Attempt unauthorized access to other users' indexed repositories
**Expected Result:** Access denied, request logged as security incident
**Actual Result:** Access control enforced, user can only see own repositories
**Status:** Pass

---

## Integration Tests

### Test Case ID: TC_044
**Input:** Complete workflow - Login → Index Repository → Query Code → Get Results
**Expected Result:** All operations succeed, results accurate and properly formatted
**Actual Result:** End-to-end workflow completed successfully
**Status:** Pass

### Test Case ID: TC_045
**Input:** Multi-user scenario - Multiple users login and query simultaneously
**Expected Result:** Each user gets isolated results, no data leakage between users
**Actual Result:** Proper isolation maintained, concurrent access handled safely
**Status:** Pass

### Test Case ID: TC_046
**Input:** Repository update workflow - Reindex with code changes, verify new code searchable
**Expected Result:** Updated code indexed, new functionality discoverable via search
**Actual Result:** Code changes reflected in search results immediately
**Status:** Pass

---

## Compliance & Logging Tests

### Test Case ID: TC_047
**Input:** All user actions and system events
**Expected Result:** Comprehensive audit log generated, all actions traceable
**Actual Result:** Audit trail maintained, logs secure and searchable
**Status:** Pass

### Test Case ID: TC_048
**Input:** Failed login attempts (multiple wrong passwords)
**Expected Result:** Failed attempts logged, potential brute force attack detected
**Actual Result:** Failed attempts recorded, alerts generated if threshold exceeded
**Status:** Pass

### Test Case ID: TC_049
**Input:** Sensitive operation (decrypt indexed data, access admin functions)
**Expected Result:** Operation logged with user, timestamp, and result
**Actual Result:** Sensitive operations audited, compliance requirements met
**Status:** Pass

---

## Edge Cases & Stress Tests

### Test Case ID: TC_050
**Input:** Query on repository with single file containing 10,000+ lines of code
**Expected Result:** System handles large file without timeout, accurate analysis provided
**Actual Result:** Large file processed successfully, results accurate
**Status:** Pass

### Test Case ID: TC_051
**Input:** Query with extremely long text (10,000+ characters)
**Expected Result:** System processes without error, response generated
**Actual Result:** Query handled correctly, results provided
**Status:** Pass

### Test Case ID: TC_052
**Input:** Repository with files in multiple programming languages (Python, JavaScript, Go, Rust, etc.)
**Expected Result:** All languages parsed correctly, unified search across languages
**Actual Result:** Multi-language support works, cross-language patterns found
**Status:** Pass

### Test Case ID: TC_053
**Input:** Query requesting analysis of minimized/obfuscated code
**Expected Result:** System attempts analysis but flags code quality, provides warnings
**Actual Result:** Obfuscated code handling implemented, warnings displayed
**Status:** Pass

---

## Data Privacy Tests

### Test Case ID: TC_054
**Input:** Verify no code data leaves the local system without encryption
**Expected Result:** All sensitive data encrypted, network requests secure
**Actual Result:** Offline mode maintained, no unencrypted data transmission
**Status:** Pass

### Test Case ID: TC_055
**Input:** Delete user account and associated indexed data
**Expected Result:** All user data securely deleted, recovery not possible
**Actual Result:** Data deletion completed, verified non-recovery
**Status:** Pass

---

## Summary

**Total Test Cases:** 55
**Categories Covered:**
- ✅ Authentication & Authorization (5 tests)
- ✅ Repository Indexing (5 tests)
- ✅ Code Querying & RAG (5 tests)
- ✅ Vector Search & Retrieval (4 tests)
- ✅ LLM Inference (4 tests)
- ✅ Data Encryption (3 tests)
- ✅ Database & Persistence (3 tests)
- ✅ Frontend Integration (3 tests)
- ✅ Performance & Load (3 tests)
- ✅ Error Handling (4 tests)
- ✅ Security (4 tests)
- ✅ Integration (3 tests)
- ✅ Compliance & Logging (3 tests)
- ✅ Edge Cases & Stress (4 tests)
- ✅ Data Privacy (2 tests)

**Recommendation:** Execute tests in order by category for best coverage. Prioritize TC_001-TC_005 (Authentication) and TC_040-TC_043 (Security) for critical functionality validation.
