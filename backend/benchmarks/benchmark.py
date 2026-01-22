# benchmark.py - Performance & accuracy benchmark for PrivCode

import json
import time

from tabulate import tabulate

from backend.core.logger import setup_logger
from backend.services.indexer import incremental_index
from backend.services.privcode import query_rag

logger = setup_logger()

REPO_PATH = "test_repo"
INDEX_PATH = "index"

test_queries = [
    "Find security vulnerabilities in auth.py",
    "Explain database connection flow",
    "Detect potential memory leaks",
    "Refactor API class for better design",
    "Find race conditions in concurrent code",
    "Show authentication and authorization logic",
    "Explain error handling strategy",
    "Locate inefficient loops or performance bottlenecks",
    "Identify unused or dead code",
    "Explain how configuration is loaded and used",
]


def run_benchmarks():
    print("🔒 PrivCode Benchmark Starting...\n")
    logger.info("Benchmark started")

    print("📦 Running incremental indexing...")
    index_start = time.time()
    incremental_index(REPO_PATH, INDEX_PATH)
    index_time = time.time() - index_start

    logger.info("Index time: %.2fs", index_time)
    print(f"⏱️  Index time: {index_time:.2f} seconds\n")

    print(f"🔍 Running {len(test_queries)} queries...\n")
    print("=" * 80)

    rows = []
    total_time = 0
    success_count = 0

    for i, query in enumerate(test_queries, 1):
        print(f"\n📝 Query {i}/{len(test_queries)}")
        print(f"❓ {query}")

        start_time = time.time()
        try:
            answer = query_rag(query)
            elapsed = time.time() - start_time
            total_time += elapsed

            answer_len = len(answer.strip())
            has_context = any(
                kw in answer.lower() for kw in ("file", "function", "class", "code", ".py", ".js")
            )

            if answer_len > 50 and has_context:
                status = "✅ Good"
                success_count += 1
            elif answer_len > 20:
                status = "⚠️ Partial"
            else:
                status = "❌ Weak"

            rows.append([i, query, f"{elapsed:.2f}s", answer_len, status])

            print(f"   ⏱️  Time: {elapsed:.2f}s | 🎯 {status}")
            print(f"   📄 Preview: {answer[:120]}...")

        except Exception as exc:  # noqa: BLE001
            elapsed = time.time() - start_time
            logger.error("Query failed: %s", exc, exc_info=True)

            rows.append([i, query, f"{elapsed:.2f}s", 0, "❌ Error"])
            print(f"   ❌ Error: {exc}")

    print("\n" + "=" * 80)
    print("📊 QUERY PERFORMANCE TABLE")
    print("=" * 80)

    headers = ["#", "Query", "Time", "Answer Length", "Quality"]
    print(tabulate(rows, headers=headers, tablefmt="grid"))

    avg_time = total_time / len(test_queries)
    pass_fail = "✅ PASS" if avg_time < 4 else "⚠️ NEEDS IMPROVEMENT"

    print("\n" + "=" * 80)
    print("📈 BENCHMARK SUMMARY")
    print("=" * 80)
    print(f"Index time        : {index_time:.2f} sec")
    print(f"Total queries     : {len(test_queries)}")
    print(f"Successful        : {success_count}/{len(test_queries)}")
    print(f"Total query time  : {total_time:.2f} sec")
    print(f"Average response  : {avg_time:.2f} sec")
    print(f"Target (<4 sec)   : {pass_fail}")
    print("=" * 80)

    output_file = "benchmark_results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "index_time_sec": round(index_time, 2),
                "summary": {
                    "total_queries": len(test_queries),
                    "successful": success_count,
                    "total_query_time_sec": round(total_time, 2),
                    "avg_response_time_sec": round(avg_time, 2),
                },
                "results": [
                    {
                        "query": r[1],
                        "time": r[2],
                        "answer_length": r[3],
                        "quality": r[4],
                    }
                    for r in rows
                ],
            },
            f,
            ensure_ascii=False,
            indent=2,
        )


if __name__ == "__main__":
    run_benchmarks()# benchmark.py - Performance & accuracy benchmark for PrivCode

import json
import time
from pathlib import Path

from tabulate import tabulate

from backend.core.logger import setup_logger
from backend.services.indexer import incremental_index
from backend.services.privcode import query_rag

logger = setup_logger()

ROOT_DIR = Path(__file__).resolve().parents[2]
REPO_PATH = ROOT_DIR / "test_repo"
INDEX_PATH = ROOT_DIR / "index"

test_queries = [
    "Find security vulnerabilities in auth.py",
    "Explain database connection flow",
    "Detect potential memory leaks",
    "Refactor API class for better design",
    "Find race conditions in concurrent code",
    "Show authentication and authorization logic",
    "Explain error handling strategy",
    "Locate inefficient loops or performance bottlenecks",
    "Identify unused or dead code",
    "Explain how configuration is loaded and used",
]


def run_benchmarks():
    print("🔒 PrivCode Benchmark Starting...\n")
    logger.info("Benchmark started")

    print("📦 Running incremental indexing...")
    index_start = time.time()
    incremental_index(REPO_PATH, INDEX_PATH)
    index_time = time.time() - index_start

    logger.info("Index time: %.2fs", index_time)
    print(f"⏱️  Index time: {index_time:.2f} seconds\n")

    print(f"🔍 Running {len(test_queries)} queries...\n")
    print("=" * 80)

    rows = []
    total_time = 0
    success_count = 0

    for i, query in enumerate(test_queries, 1):
        print(f"\n📝 Query {i}/{len(test_queries)}")
        print(f"❓ {query}")

        start_time = time.time()
        try:
            answer = query_rag(query)
            elapsed = time.time() - start_time
            total_time += elapsed

            answer_len = len(answer.strip())
            has_context = any(
                kw in answer.lower()
                for kw in ("file", "function", "class", "code", ".py", ".js")
            )

            if answer_len > 50 and has_context:
                status = "✅ Good"
                success_count += 1
            elif answer_len > 20:
                status = "⚠️ Partial"
            else:
                status = "❌ Weak"

            rows.append([i, query, f"{elapsed:.2f}s", answer_len, status])

            print(f"   ⏱️  Time: {elapsed:.2f}s | 🎯 {status}")
            print(f"   📄 Preview: {answer[:120]}...")

        except Exception as exc:  # noqa: BLE001
            elapsed = time.time() - start_time
            logger.error("Query failed: %s", exc, exc_info=True)

            rows.append([i, query, f"{elapsed:.2f}s", 0, "❌ Error"])
            print(f"   ❌ Error: {exc}")

    print("\n" + "=" * 80)
    print("📊 QUERY PERFORMANCE TABLE")
    print("=" * 80)

    headers = ["#", "Query", "Time", "Answer Length", "Quality"]
    print(tabulate(rows, headers=headers, tablefmt="grid"))

    avg_time = total_time / len(test_queries)
    pass_fail = "✅ PASS" if avg_time < 4 else "⚠️ NEEDS IMPROVEMENT"

    print("\n" + "=" * 80)
    print("📈 BENCHMARK SUMMARY")
    print("=" * 80)
    print(f"Index time        : {index_time:.2f} sec")
    print(f"Total queries     : {len(test_queries)}")
    print(f"Successful        : {success_count}/{len(test_queries)}")
    print(f"Total query time  : {total_time:.2f} sec")
    print(f"Average response  : {avg_time:.2f} sec")
    print(f"Target (<4 sec)   : {pass_fail}")
    print("=" * 80)

    output_file = ROOT_DIR / "benchmark_results.json"
    with output_file.open("w", encoding="utf-8") as f:
        json.dump(
            {
                "index_time_sec": round(index_time, 2),
                "summary": {
                    "total_queries": len(test_queries),
                    "successful": success_count,
                    "total_query_time_sec": round(total_time, 2),
                    "avg_response_time_sec": round(avg_time, 2),
                },
                "results": [
                    {
                        "query": r[1],
                        "time": r[2],
                        "answer_length": r[3],
                        "quality": r[4],
                    }
                    for r in rows
                ],
            },
            f,
            indent=2,
        )


if __name__ == "__main__":
    run_benchmarks()