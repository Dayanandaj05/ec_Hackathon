const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const BASE = 'http://localhost:3000/api';
let savedFileId = null;
let sessionCookie = '';  // This holds the wristband
let savedFolderId = null;

fs.writeFileSync('testfile.txt', 'Hello hackathon test file');

async function runTests() {

  console.log('\n========== TEST 1: LOGIN ==========' );
  const loginRes = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'alice', password: 'pass1' })
  });

  // Grab the session cookie from the login response
  sessionCookie = loginRes.headers.get('set-cookie');
  console.log('Session cookie captured:', sessionCookie ? 'YES' : 'NO');

  const login = await loginRes.json();
  console.log(JSON.stringify(login, null, 2));
  const userId = login.data?.userId;

  if (!userId) {
    console.log('LOGIN FAILED — stopping tests');
    return;
  }

  console.log('\n========== TEST 2: UPLOAD ==========' );
  const form = new FormData();
  form.append('file', fs.createReadStream('testfile.txt'));
  form.append('userId', userId);

  const uploadRes = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { 'Cookie': sessionCookie },  // Send the wristband
    body: form
  });
  const upload = await uploadRes.json();
  console.log(JSON.stringify(upload, null, 2));
  savedFileId = upload.data?.id;

  if (!savedFileId) {
    console.log('UPLOAD FAILED — stopping tests');
    return;
  }

  console.log('\n========== TEST 3: CREATE FOLDER ==========' );
  const folderRes = await fetch(`${BASE}/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    },
    body: JSON.stringify({ name: 'Test Folder', parentId: null })
  });
  const folder = await folderRes.json();
  console.log(JSON.stringify(folder, null, 2));
  savedFolderId = folder.data?.id;

  if (!savedFolderId) {
    console.log('FOLDER CREATE FAILED — stopping tests');
    return;
  }

  console.log('\n========== TEST 4: DOWNLOAD ==========' );
  const downloadRes = await fetch(`${BASE}/download/${savedFileId}`, {
    headers: { 'Cookie': sessionCookie }   // Send the wristband
  });
  console.log('Download status:', downloadRes.status);
  console.log('Content-Type:', downloadRes.headers.get('content-type'));

  console.log('\n========== TEST 5: MOVE ==========' );
  const moveRes = await fetch(`${BASE}/files/${savedFileId}/move`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie              // Send the wristband
    },
    body: JSON.stringify({ targetFolderId: savedFolderId })
  });
  const move = await moveRes.json();
  console.log(JSON.stringify(move, null, 2));

  console.log('\n========== TEST 6: DELETE ==========' );
  const deleteRes = await fetch(`${BASE}/files/${savedFileId}`, {
    method: 'DELETE',
    headers: { 'Cookie': sessionCookie }   // Send the wristband
  });
  const del = await deleteRes.json();
  console.log(JSON.stringify(del, null, 2));

  console.log('\n========== ALL TESTS DONE ==========' );
}

runTests().catch(console.error);
