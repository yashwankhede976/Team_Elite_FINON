/**
 * merchant_categories.ts
 * ─────────────────────────────────────────────────────────
 * Bundled merchant keyword → category dictionary.
 * Used by the client-side categorisation engine.
 * Data never leaves the browser.
 */

export const MERCHANT_CATEGORIES: Record<string, string[]> = {
  "Food & Dining": [
    "swiggy", "zomato", "dominos", "dominoes", "pizza hut", "kfc", "mcdonald",
    "burger king", "subway", "haldiram", "barbeque nation", "wow momo",
    "biryani", "dhaba", "restaurant", "cafe", "coffee", "starbucks", "chaayos",
    "chai point", "freshmenu", "box8", "faasos", "behrouz", "ovenstory",
    "lunchbox", "rebel foods", "eatfit", "eat.fit", "the good bowl", "mealful",
    "paradise", "meghana", "pind balluchi", "bikanervala", "karachi bakery",
    "naturals ice cream", "baskin robbins", "kwality walls", "amul",
    "milkbasket", "bigbasket", "grofers", "blinkit", "zepto", "swiggy instamart", "jiomart",
  ],
  "Transport": [
    "ola", "uber", "rapido", "meru", "taxiforsure", "jugnoo", "bounce",
    "yulu", "vogo", "petrol", "diesel", "fuel", "hp petrol", "ioc", "bpcl",
    "indian oil", "shell", "reliance fuel", "irctc", "indian railways",
    "redbus", "abhibus", "msrtc", "ksrtc", "makemytrip flights",
    "goibibo flights", "indigo", "air india", "spicejet", "vistara", "akasa",
    "ola electric", "metro", "dmrc", "bmrc", "mmrc", "fastag", "nhai", "toll", "parking",
  ],
  "Shopping": [
    "amazon", "flipkart", "myntra", "ajio", "nykaa", "snapdeal", "meesho",
    "shopclues", "paytm mall", "tatacliq", "croma", "reliance digital",
    "vijay sales", "d-mart", "big bazaar", "more supermarket", "spencers",
    "star bazaar", "lifestyle", "westside", "shoppers stop", "pantaloons",
    "zara", "h&m", "max fashion", "v-mart", "reliance trends", "brand factory",
    "firstcry", "hopscotch", "lenskart", "boat", "realme", "mi store", "apple store",
    "samsung", "oneplus", "fastrack", "titan", "tanishq", "malabar gold",
    "joyalukkas", "kalyan jewellers",
  ],
  "Utilities": [
    "electricity", "bescom", "msedcl", "tpddl", "bses", "reliance energy",
    "water", "bwssb", "gas", "indane", "hp gas", "bharat gas", "piped gas",
    "mahanagar gas", "igl", "internet", "broadband", "jio fiber", "airtel fiber",
    "act fibernet", "hathway", "tatasky", "dish tv", "sun direct", "d2h",
    "airtel", "jio", "vi ", "vodafone", "idea", "bsnl", "mtnl",
    "electricity bill", "water bill", "maintenance",
  ],
  "Healthcare": [
    "apollo", "fortis", "max hospital", "medanta", "narayana", "manipal",
    "aiims", "dr lal", "lal pathlabs", "thyrocare", "1mg", "netmeds",
    "pharmeasy", "medlife", "flipkart health", "medplus", "wellness forever",
    "healthkart", "cult.fit", "cure.fit", "curefit", "cultfit", "doctor",
    "hospital", "clinic", "pharmacy", "chemist", "medicine", "diagnostic",
    "lab test", "health insurance", "star health", "niva bupa", "care health",
  ],
  "Entertainment": [
    "bookmyshow", "pvr", "inox", "cinepolis", "carnival cinemas",
    "netflix", "amazon prime", "hotstar", "disney", "sonyliv", "zee5",
    "voot", "jiocinema", "mxplayer", "youtube premium", "spotify",
    "gaana", "jiosaavn", "wynk", "hungama", "steam", "epic games",
    "dream11", "my11circle", "mpl", "fantasy cricket", "gaming",
    "club mahindra", "thomas cook", "yatra",
  ],
  "Subscriptions": [
    "netflix", "amazon prime", "hotstar", "spotify", "apple one",
    "google one", "microsoft 365", "adobe", "zoom", "slack", "dropbox",
    "canva", "figma", "notion", "grammarly", "linkedin premium",
    "subscription", "monthly plan", "annual plan", "renew", "renewal",
    "auto debit", "standing instruction", "si ",
  ],
  "Education": [
    "byjus", "byju", "unacademy", "vedantu", "toppr", "physics wallah",
    "physicswallah", "doubtnut", "gradeup", "testbook", "upgrad",
    "simplilearn", "coursera", "udemy", "edx", "great learning",
    "school fee", "tuition", "coaching", "exam fee", "university",
    "college fee", "hostel fee",
  ],
  "Housing & Rent": [
    "rent", "housing", "nobroker", "magicbricks", "99acres", "housing.com",
    "society maintenance", "maintenance charge", "property tax",
    "flat", "apartment", "coliving", "oyo life", "nestaway", "stanza living",
  ],
  "Personal Care": [
    "salon", "spa", "parlour", "naturals salon", "lakme", "wella",
    "loreal", "haircafe", "barbershop", "grooming", "haircut",
    "manicure", "pedicure", "massage", "yoga", "gym", "fitness",
    "gold's gym", "anytime fitness", "snap fitness",
  ],
  "Finance & Insurance": [
    "lic", "hdfc life", "icici prudential", "sbi life", "bajaj allianz",
    "max life", "kotak life", "tata aia", "emi", "loan emi", "mortgage",
    "mutual fund", "zerodha", "groww", "upstox", "coin", "paytm money",
    "kuvera", "smallcase", "nps", "ppf", "fixed deposit",
  ],
  "Travel": [
    "makemytrip", "goibibo", "yatra", "cleartrip", "ixigo", "oyo",
    "treebo", "fabhotel", "airbnb", "hotel", "resort", "hostel",
    "taj hotels", "ihg", "marriott", "hyatt", "radisson", "hilton",
    "holiday", "tour", "travel agent", "visa fee",
  ],
};
