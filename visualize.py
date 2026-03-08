import pinecone
from nomic import atlas
import nomic
import numpy as np

# --- CONFIGURATION ---
PINECONE_KEY = "USE_YOUR_PINECONE-API_KEY"
NOMIC_KEY = "USE_YOUR_NOMIC-API_KEY"
INDEX_NAME = "USE_YOUR_PINECONE-INDEX_NAME"
NAMESPACE = "USE_YOUR_PINECONE-NAMESPACE"
DIMENSION = 1536 

# --- INITIALIZATION ---
nomic.login(NOMIC_KEY)
pc = pinecone.Pinecone(api_key=PINECONE_KEY)
index = pc.Index(INDEX_NAME)

# --- STEP 1: FETCH DATA FROM PINECONE ---
print(f"Fetching vectors from Pinecone index: {INDEX_NAME} (Namespace: {NAMESPACE})...")

results = index.query(
    vector=[0.0] * DIMENSION, 
    top_k=10000, 
    include_values=True, 
    include_metadata=True,
    namespace=NAMESPACE
)

ids = []
embeddings = []
metadata = []

if not results['matches']:
    print("Error: No vectors found. Check if your DIMENSION (1536) is correct for this index.")
    exit()

for match in results['matches']:
    ids.append(match['id'])
    embeddings.append(match['values'])
    meta = match.get('metadata', {})
    meta['id'] = match['id'] 
    metadata.append(meta)

embeddings_np = np.array(embeddings)
print(f"Successfully retrieved {len(ids)} vectors.")

# --- STEP 2: CREATE THE NOMIC MAP ---
print("Creating Nomic Atlas map (this may take a minute)...")
project = atlas.map_data(
    embeddings=embeddings_np,
    data=metadata,
    id_field='id',
    identifier=f"Pinecone Map: {INDEX_NAME}",
    description="Visual cluster analysis of Pinecone vectors."
)

print(f"DONE! View your visual map here: {project.maps[0].map_link}")