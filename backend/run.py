import os
import sys

# Add './lib' directory to sys.path so python can load our bundled dependencies
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lib'))

import uvicorn

if __name__ == "__main__":
    # AppSail injects X_ZOHO_CATALYST_LISTEN_PORT. Default to 9000 to match Zoho configuration.
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT", 9000))
    # Run the Uvicorn server referencing the backend.main module and app instance
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)

