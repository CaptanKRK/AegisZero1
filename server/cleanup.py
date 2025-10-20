"""Small helper to remove __pycache__ and .pyc files from the project root.
Run: python cleanup.py
"""
import os
import shutil

ROOT = os.path.dirname(__file__)
pycache = os.path.join(ROOT, '__pycache__')

def remove_pycache():
    if os.path.isdir(pycache):
        try:
            shutil.rmtree(pycache)
            print('Removed', pycache)
        except Exception as e:
            print('Failed to remove', pycache, e)
    else:
        print('__pycache__ not found; nothing to remove')

if __name__ == '__main__':
    remove_pycache()
