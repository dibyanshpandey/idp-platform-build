import re
from itertools import combinations

def extract_numbers_recursively(data) -> list:
    numbers = []
    if isinstance(data, dict):
        for k, v in data.items():
             numbers.extend(extract_numbers_recursively(v))
    elif isinstance(data, list):
        for item in data:
            numbers.extend(extract_numbers_recursively(item))
    else:
        if isinstance(data, (int, float)):
            numbers.append(float(data))
        elif isinstance(data, str):
            # Explicitly strip currency symbols and commas
            cleaned = re.sub(r'[$,€£]|INR', '', data, flags=re.IGNORECASE)
            cleaned = cleaned.replace(',', '')
            cleaned = re.sub(r'[^\d.-]', '', cleaned)
            if cleaned:
                try:
                    numbers.append(float(cleaned))
                except:
                    pass
    return numbers

def analyze_logical(extracted_data: dict) -> dict:
    """
    Generic mathematical validation.
    Extracts all numbers and checks if any number is the sum of a subset of other numbers.
    Does not restrict to specific keys like 'Subtotal' or 'Total'.
    """
    if not extracted_data:
        return {"status": "Review", "reason": "No extracted data provided for validation."}

    all_nums = extract_numbers_recursively(extracted_data)
    amounts = [n for n in all_nums if n > 0.0]
    
    if len(amounts) < 3:
         return {"status": "Pass", "reason": "Not enough numeric data for sum validation."}
         
    amounts = [round(a, 2) for a in amounts]
    amounts.sort(reverse=True)
    
    # Identify the maximum extracted float as the assumed Grand Total
    target = amounts[0]
    others = amounts[1:]
    
    if not others:
        pass
    else:
        # Try finding a combination up to size 6
        for r in range(2, min(7, len(others) + 1)):
            for combo in combinations(others, r):
                if abs(sum(combo) - target) < 0.05:
                    return {
                        "status": "Pass",
                        "reason": f"Math validated: Grand Total {target} is the sum of {combo}"
                    }
    
    # Check if a 'total' key exists but didn't match any sum
    has_total_key = False
    if isinstance(extracted_data, dict):
        has_total_key = any('total' in str(k).lower() for k in extracted_data.keys())
        
    if has_total_key:
        return {
             "status": "Fail",
             "reason": "Math Validation Failed: Document has a 'Total' but values do not sum correctly."
        }

    return {
        "status": "Pass",
        "reason": "No sum relationships expected or found."
    }
