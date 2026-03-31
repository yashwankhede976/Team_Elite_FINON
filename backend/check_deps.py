try:
    import pymongo
    print("pymongo: OK")
except ImportError:
    print("pymongo: MISSING")

try:
    import openai
    print("openai: OK")
except ImportError:
    print("openai: MISSING")

try:
    import PyPDF2
    print("PyPDF2: OK")
except ImportError:
    print("PyPDF2: MISSING")

try:
    import PIL
    print("PIL: OK")
except ImportError:
    print("PIL: MISSING")

try:
    import pytesseract
    print("pytesseract: OK")
except ImportError:
    print("pytesseract: MISSING")
