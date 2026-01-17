# benchmark.py - Performance & accuracy benchmark for PrivCode
import time
import json
from privcode import generate_answer
from logger import setup_logger
logger = setup_logger()

# Sample test queries (customize based on your test_repo content)
test_queries = [
    "Explain how user authentication works",
    "Find all payment-related code",
    "Are there any potential bugs or security issues?",
    "Show me database connection logic",
    "How is error handling implemented?"
]

def run_benchmarks():
    print("🔒 PrivCode Benchmark Starting...\n")
    print(f"Testing on {len(test_queries)} queries\n")
    print("="*60)
    
    total_time = 0
    results = []
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n📝 Query {i}/{len(test_queries)}: {query}")
        start_time = time.time()
        
        try:
            # Call your generate_answer function (returns string)
            answer = generate_answer(query)
            
            elapsed = time.time() - start_time
            total_time += elapsed
            
            print(f"   ⏱️  Response time: {elapsed:.2f} seconds")
            
            # Quality check (adjusted for string response)
            has_answer = len(answer.strip()) > 20
            has_code_context = any(keyword in answer.lower() for keyword in ['file:', 'function', 'class', 'code'])
            
            if has_answer and has_code_context:
                status = "✅ Good"
            elif has_answer:
                status = "⚠️  Partial"
            else:
                status = "❌ Weak/Missing"
            
            print(f"   🎯 Quality: {status}")
            print(f"   📄 Answer preview: {answer[:100]}...")
            
            results.append({
                "query": query,
                "time_sec": round(elapsed, 2),
                "answer_length": len(answer),
                "status": status
            })
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            results.append({
                "query": query,
                "time_sec": 0,
                "answer_length": 0,
                "status": "❌ Error"
            })
    
    # Summary
    avg_time = total_time / len(test_queries) if results else 0
    successful = sum(1 for r in results if "Good" in r["status"])
    
    print("\n" + "="*60)
    print("📊 BENCHMARK SUMMARY")
    print("="*60)
    print(f"Total queries     : {len(test_queries)}")
    print(f"Successful        : {successful}/{len(test_queries)}")
    print(f"Total time        : {total_time:.2f} sec")
    print(f"Average response  : {avg_time:.2f} sec")
    print(f"Target (<4 sec)   : {'✅ PASS' if avg_time < 4 else '⚠️  NEEDS IMPROVEMENT'}")
    print("="*60)
    
    # Save results
    output_file = "benchmark_results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "summary": {
                "total_queries": len(test_queries),
                "successful": successful,
                "total_time_sec": round(total_time, 2),
                "avg_time_sec": round(avg_time, 2)
            },
            "details": results
        }, f, indent=2)
    
    print(f"\n💾 Results saved to: {output_file}")

if __name__ == "__main__":
    run_benchmarks()