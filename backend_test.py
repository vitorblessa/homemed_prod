#!/usr/bin/env python3
"""
HomeMed Backend Family Sharing Test Suite
Tests all family sharing endpoints and push subscription endpoints
"""

import requests
import json
from pymongo import MongoClient
import uuid
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://family-med-tracker-1.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "homemed"

# Test results
results = []
test_data = {}

def log_test(test_num, description, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    results.append({
        "test": test_num,
        "description": description,
        "status": status,
        "details": details
    })
    print(f"\nTest {test_num}: {description}")
    print(f"{status} - {details}")

def setup_fake_sessions():
    """Setup fake sessions for vitor and family_member"""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Clean up any existing test sessions
    db.sessions.delete_many({'token': {'$in': ['fam_test_1', 'fam_test_2']}})
    
    # Create session for vitor
    db.sessions.insert_one({
        'token': 'fam_test_1',
        'email': 'vitor.blessa@gmail.com',
        'name': 'Vitor',
        'picture': '',
        'expires_at': datetime.now() + timedelta(hours=2),
        'created_at': datetime.now()
    })
    
    # Create session for family_member
    db.sessions.insert_one({
        'token': 'fam_test_2',
        'email': 'family_member@test.com',
        'name': 'Membro',
        'picture': '',
        'expires_at': datetime.now() + timedelta(hours=2),
        'created_at': datetime.now()
    })
    
    # Ensure family_member user exists
    db.users.update_one(
        {'email': 'family_member@test.com'},
        {'$set': {'email': 'family_member@test.com', 'name': 'Membro'}},
        upsert=True
    )
    
    # Make sure vitor is NOT in a family initially
    db.users.update_one(
        {'email': 'vitor.blessa@gmail.com'},
        {'$unset': {'family_id': ''}}
    )
    
    # Remove family_id from vitor's medicines (reset to personal medicines)
    db.medicines.update_many(
        {'user_email': 'vitor.blessa@gmail.com'},
        {'$unset': {'family_id': ''}}
    )
    
    client.close()
    print("✅ Fake sessions created for vitor.blessa@gmail.com and family_member@test.com")

def cleanup_test_data():
    """Clean up all test data"""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Remove test sessions
    db.sessions.delete_many({'token': {'$in': ['fam_test_1', 'fam_test_2']}})
    
    # Remove test family_member user
    db.users.delete_many({'email': 'family_member@test.com'})
    
    # Remove vitor's family_id
    db.users.update_one(
        {'email': 'vitor.blessa@gmail.com'},
        {'$unset': {'family_id': ''}}
    )
    
    # Delete any test families
    if 'family_id' in test_data:
        db.families.delete_one({'id': test_data['family_id']})
    
    # Delete push subscriptions
    db.push_subscriptions.delete_many({'endpoint': 'https://fake.push.endpoint/xyz'})
    
    client.close()
    print("\n🧹 Test data cleaned up")

def run_tests():
    """Execute all family sharing tests"""
    print("=" * 80)
    print("HomeMed Backend Family Sharing Test Suite")
    print("=" * 80)
    
    # Setup
    setup_fake_sessions()
    
    vitor_cookie = {'homemed_session': 'fam_test_1'}
    member_cookie = {'homemed_session': 'fam_test_2'}
    
    # Test 1: GET /api/families/me with vitor's cookie (no family yet) → {family: null}
    try:
        resp = requests.get(f"{BASE_URL}/families/me", cookies=vitor_cookie)
        data = resp.json()
        passed = resp.status_code == 200 and data.get('family') is None
        log_test(1, "GET /families/me (no family yet)", passed, 
                f"Status: {resp.status_code}, Response: {data}")
    except Exception as e:
        log_test(1, "GET /families/me (no family yet)", False, f"Error: {str(e)}")
    
    # Test 2: POST /api/families with body {"name":"Família Blessa"} as vitor
    try:
        resp = requests.post(f"{BASE_URL}/families", 
                           json={"name": "Família Blessa"}, 
                           cookies=vitor_cookie)
        data = resp.json()
        family = data.get('family', {})
        
        # Store family data for later tests
        test_data['family_id'] = family.get('id')
        test_data['invite_code'] = family.get('invite_code')
        
        passed = (resp.status_code == 200 and 
                 family.get('id') is not None and
                 len(family.get('invite_code', '')) == 10 and
                 family.get('owner_email') == 'vitor.blessa@gmail.com' and
                 len(family.get('members', [])) == 1 and
                 family['members'][0]['email'] == 'vitor.blessa@gmail.com')
        
        log_test(2, "POST /families (create family)", passed, 
                f"Status: {resp.status_code}, Family ID: {family.get('id')}, Invite: {family.get('invite_code')}, Owner: {family.get('owner_email')}, Members: {len(family.get('members', []))}")
    except Exception as e:
        log_test(2, "POST /families (create family)", False, f"Error: {str(e)}")
    
    # Test 3: GET /api/families/me as vitor → returns the family created
    try:
        resp = requests.get(f"{BASE_URL}/families/me", cookies=vitor_cookie)
        data = resp.json()
        family = data.get('family', {})
        passed = (resp.status_code == 200 and 
                 family.get('id') == test_data.get('family_id') and
                 family.get('name') == 'Família Blessa')
        log_test(3, "GET /families/me (after creation)", passed, 
                f"Status: {resp.status_code}, Family: {family.get('name')}")
    except Exception as e:
        log_test(3, "GET /families/me (after creation)", False, f"Error: {str(e)}")
    
    # Test 4: Verify data migration - GET /api/medicines as vitor should still show all meds
    try:
        resp = requests.get(f"{BASE_URL}/medicines", cookies=vitor_cookie)
        data = resp.json()
        medicines = data.get('medicines', [])
        
        # Check if medicines have family_id set
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        sample_med = db.medicines.find_one({'user_email': 'vitor.blessa@gmail.com'})
        client.close()
        
        has_family_id = sample_med and sample_med.get('family_id') == test_data.get('family_id')
        
        passed = (resp.status_code == 200 and 
                 len(medicines) > 0 and
                 has_family_id)
        
        log_test(4, "Data migration (medicines moved to family)", passed, 
                f"Status: {resp.status_code}, Medicines count: {len(medicines)}, Family ID set: {has_family_id}")
    except Exception as e:
        log_test(4, "Data migration (medicines moved to family)", False, f"Error: {str(e)}")
    
    # Test 5: POST /api/families as vitor again → HTTP 400 "Você já está em uma família"
    try:
        resp = requests.post(f"{BASE_URL}/families", 
                           json={"name": "Another Family"}, 
                           cookies=vitor_cookie)
        data = resp.json()
        passed = (resp.status_code == 400 and 
                 'já está em uma família' in data.get('error', '').lower())
        log_test(5, "POST /families (already in family)", passed, 
                f"Status: {resp.status_code}, Error: {data.get('error')}")
    except Exception as e:
        log_test(5, "POST /families (already in family)", False, f"Error: {str(e)}")
    
    # Test 6: POST /api/families/join with invalid code → HTTP 404 "Código inválido"
    try:
        resp = requests.post(f"{BASE_URL}/families/join", 
                           json={"invite_code": "INVALID"}, 
                           cookies=member_cookie)
        data = resp.json()
        passed = (resp.status_code == 404 and 
                 'inválido' in data.get('error', '').lower())
        log_test(6, "POST /families/join (invalid code)", passed, 
                f"Status: {resp.status_code}, Error: {data.get('error')}")
    except Exception as e:
        log_test(6, "POST /families/join (invalid code)", False, f"Error: {str(e)}")
    
    # Test 7: POST /api/families/join with real code as family_member → HTTP 200
    try:
        resp = requests.post(f"{BASE_URL}/families/join", 
                           json={"invite_code": test_data.get('invite_code')}, 
                           cookies=member_cookie)
        data = resp.json()
        family = data.get('family', {})
        passed = (resp.status_code == 200 and 
                 family.get('id') == test_data.get('family_id'))
        log_test(7, "POST /families/join (valid code)", passed, 
                f"Status: {resp.status_code}, Joined family: {family.get('id')}")
    except Exception as e:
        log_test(7, "POST /families/join (valid code)", False, f"Error: {str(e)}")
    
    # Test 8: GET /api/families/me as family_member → returns same family with 2 members
    try:
        resp = requests.get(f"{BASE_URL}/families/me", cookies=member_cookie)
        data = resp.json()
        family = data.get('family', {})
        members = family.get('members', [])
        passed = (resp.status_code == 200 and 
                 family.get('id') == test_data.get('family_id') and
                 len(members) == 2)
        log_test(8, "GET /families/me (2 members)", passed, 
                f"Status: {resp.status_code}, Members: {len(members)}")
    except Exception as e:
        log_test(8, "GET /families/me (2 members)", False, f"Error: {str(e)}")
    
    # Test 9: Isolation check - GET /api/medicines as family_member should return same meds
    try:
        resp = requests.get(f"{BASE_URL}/medicines", cookies=member_cookie)
        data = resp.json()
        member_meds = data.get('medicines', [])
        
        # Get vitor's meds count
        resp2 = requests.get(f"{BASE_URL}/medicines", cookies=vitor_cookie)
        data2 = resp2.json()
        vitor_meds = data2.get('medicines', [])
        
        # Create a med as family_member
        resp3 = requests.post(f"{BASE_URL}/medicines", 
                            json={"nome_comercial": "Test Family Med", "categoria": "Teste"}, 
                            cookies=member_cookie)
        test_med_data = resp3.json()
        test_data['test_med_id'] = test_med_data.get('id')
        
        # Verify vitor can see it
        resp4 = requests.get(f"{BASE_URL}/medicines", cookies=vitor_cookie)
        data4 = resp4.json()
        vitor_meds_after = data4.get('medicines', [])
        
        passed = (resp.status_code == 200 and 
                 len(member_meds) == len(vitor_meds) and
                 len(vitor_meds_after) == len(vitor_meds) + 1)
        
        log_test(9, "Isolation check (shared family medicines)", passed, 
                f"Member meds: {len(member_meds)}, Vitor meds: {len(vitor_meds)}, After create: {len(vitor_meds_after)}")
    except Exception as e:
        log_test(9, "Isolation check (shared family medicines)", False, f"Error: {str(e)}")
    
    # Test 10: POST /api/families/regenerate-code as family_member (NOT owner) → HTTP 403
    try:
        resp = requests.post(f"{BASE_URL}/families/regenerate-code", cookies=member_cookie)
        data = resp.json()
        passed = (resp.status_code == 403 and 
                 'dono' in data.get('error', '').lower())
        log_test(10, "POST /families/regenerate-code (not owner)", passed, 
                f"Status: {resp.status_code}, Error: {data.get('error')}")
    except Exception as e:
        log_test(10, "POST /families/regenerate-code (not owner)", False, f"Error: {str(e)}")
    
    # Test 11: POST /api/families/regenerate-code as vitor (owner) → HTTP 200
    try:
        old_code = test_data.get('invite_code')
        resp = requests.post(f"{BASE_URL}/families/regenerate-code", cookies=vitor_cookie)
        data = resp.json()
        new_code = data.get('invite_code')
        
        # Verify it changed in DB
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        fam = db.families.find_one({'id': test_data.get('family_id')})
        client.close()
        
        db_code = fam.get('invite_code') if fam else None
        
        passed = (resp.status_code == 200 and 
                 new_code is not None and
                 new_code != old_code and
                 new_code == db_code)
        
        test_data['invite_code'] = new_code
        
        log_test(11, "POST /families/regenerate-code (owner)", passed, 
                f"Status: {resp.status_code}, Old: {old_code}, New: {new_code}, DB matches: {new_code == db_code}")
    except Exception as e:
        log_test(11, "POST /families/regenerate-code (owner)", False, f"Error: {str(e)}")
    
    # Test 12: DELETE /api/families/members/family_member@test.com as family_member (NOT owner) → HTTP 403
    try:
        resp = requests.delete(f"{BASE_URL}/families/members/family_member@test.com", 
                             cookies=member_cookie)
        data = resp.json()
        passed = (resp.status_code == 403 and 
                 'dono' in data.get('error', '').lower())
        log_test(12, "DELETE /families/members (not owner)", passed, 
                f"Status: {resp.status_code}, Error: {data.get('error')}")
    except Exception as e:
        log_test(12, "DELETE /families/members (not owner)", False, f"Error: {str(e)}")
    
    # Test 13: DELETE /api/families/members/family_member@test.com as vitor (owner) → HTTP 200
    try:
        resp = requests.delete(f"{BASE_URL}/families/members/family_member@test.com", 
                             cookies=vitor_cookie)
        data = resp.json()
        
        # Verify family_member's user doc no longer has family_id
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        member_user = db.users.find_one({'email': 'family_member@test.com'})
        client.close()
        
        has_no_family = member_user and member_user.get('family_id') is None
        
        passed = (resp.status_code == 200 and 
                 data.get('ok') == True and
                 has_no_family)
        
        log_test(13, "DELETE /families/members (owner removes member)", passed, 
                f"Status: {resp.status_code}, Member family_id removed: {has_no_family}")
    except Exception as e:
        log_test(13, "DELETE /families/members (owner removes member)", False, f"Error: {str(e)}")
    
    # Test 14: After removal - GET /api/medicines as family_member should return empty
    try:
        resp = requests.get(f"{BASE_URL}/medicines", cookies=member_cookie)
        data = resp.json()
        medicines = data.get('medicines', [])
        passed = resp.status_code == 200 and len(medicines) == 0
        log_test(14, "GET /medicines (after removal from family)", passed, 
                f"Status: {resp.status_code}, Medicines: {len(medicines)} (should be 0)")
    except Exception as e:
        log_test(14, "GET /medicines (after removal from family)", False, f"Error: {str(e)}")
    
    # Test 15: POST /api/families/leave as vitor (last member/owner) → HTTP 200
    try:
        resp = requests.post(f"{BASE_URL}/families/leave", cookies=vitor_cookie)
        data = resp.json()
        
        # Verify family is deleted from DB
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        fam = db.families.find_one({'id': test_data.get('family_id')})
        
        # Check vitor's medicines still exist
        vitor_meds = db.medicines.count_documents({'user_email': 'vitor.blessa@gmail.com'})
        
        client.close()
        
        family_deleted = fam is None
        
        passed = (resp.status_code == 200 and 
                 data.get('ok') == True and
                 family_deleted and
                 vitor_meds > 0)
        
        log_test(15, "POST /families/leave (last member)", passed, 
                f"Status: {resp.status_code}, Family deleted: {family_deleted}, Vitor meds: {vitor_meds}")
    except Exception as e:
        log_test(15, "POST /families/leave (last member)", False, f"Error: {str(e)}")
    
    # Test 16: POST /api/push/subscribe with valid subscription → HTTP 200
    try:
        subscription = {
            "subscription": {
                "endpoint": "https://fake.push.endpoint/xyz",
                "keys": {
                    "p256dh": "key",
                    "auth": "auth"
                }
            }
        }
        resp = requests.post(f"{BASE_URL}/push/subscribe", 
                           json=subscription, 
                           cookies=vitor_cookie)
        data = resp.json()
        passed = resp.status_code == 200 and data.get('ok') == True
        log_test(16, "POST /push/subscribe (valid)", passed, 
                f"Status: {resp.status_code}, Response: {data}")
    except Exception as e:
        log_test(16, "POST /push/subscribe (valid)", False, f"Error: {str(e)}")
    
    # Test 17: POST /api/push/subscribe without endpoint → HTTP 400
    try:
        resp = requests.post(f"{BASE_URL}/push/subscribe", 
                           json={"subscription": {"keys": {}}}, 
                           cookies=vitor_cookie)
        data = resp.json()
        passed = resp.status_code == 400 and 'error' in data
        log_test(17, "POST /push/subscribe (no endpoint)", passed, 
                f"Status: {resp.status_code}, Error: {data.get('error')}")
    except Exception as e:
        log_test(17, "POST /push/subscribe (no endpoint)", False, f"Error: {str(e)}")
    
    # Test 18: POST /api/push/unsubscribe with endpoint → HTTP 200
    try:
        resp = requests.post(f"{BASE_URL}/push/unsubscribe", 
                           json={"endpoint": "https://fake.push.endpoint/xyz"}, 
                           cookies=vitor_cookie)
        data = resp.json()
        passed = resp.status_code == 200 and data.get('ok') == True
        log_test(18, "POST /push/unsubscribe", passed, 
                f"Status: {resp.status_code}, Response: {data}")
    except Exception as e:
        log_test(18, "POST /push/unsubscribe", False, f"Error: {str(e)}")
    
    # Cleanup
    cleanup_test_data()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed_count = sum(1 for r in results if "✅ PASS" in r['status'])
    failed_count = sum(1 for r in results if "❌ FAIL" in r['status'])
    total_count = len(results)
    
    print(f"\nTotal Tests: {total_count}")
    print(f"Passed: {passed_count} ✅")
    print(f"Failed: {failed_count} ❌")
    print(f"Success Rate: {(passed_count/total_count*100):.1f}%")
    
    if failed_count > 0:
        print("\n❌ FAILED TESTS:")
        for r in results:
            if "❌ FAIL" in r['status']:
                print(f"  - Test {r['test']}: {r['description']}")
                print(f"    Details: {r['details']}")
    
    print("\n" + "=" * 80)
    
    return passed_count == total_count

if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
