"""PropChain Application Package."""
import sys
from pathlib import Path

# Automatically bridge to local .venv site-packages if running with system/global python
_venv_site_packages = Path(__file__).resolve().parent.parent / ".venv" / "Lib" / "site-packages"
if _venv_site_packages.is_dir() and str(_venv_site_packages) not in sys.path:
    sys.path.insert(0, str(_venv_site_packages))

