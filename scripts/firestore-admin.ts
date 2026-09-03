import * as admin from 'firebase-admin';
import { credential } from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../firebase-service-account.json'), 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any)
  });
}

const db = admin.firestore();

async function listCollections() {
  console.log('\n📁 Colecciones en Firestore:\n');
  const collections = await db.listCollections();
  collections.forEach(col => {
    console.log(`  - ${col.id}`);
  });
}

async function getUsers() {
  console.log('\n👥 Usuarios en Firebase Auth:\n');
  
  try {
    const listUsers = await admin.auth().listUsers();
    if (listUsers.users.length === 0) {
      console.log('  No hay usuarios en Auth');
      return;
    }
    
    listUsers.users.forEach(user => {
      console.log(`  UID: ${user.uid}`);
      console.log(`  Email: ${user.email || 'N/A'}`);
      console.log(`  Email Verified: ${user.emailVerified}`);
      console.log(`  Created: ${new Date(user.metadata.createdAt).toLocaleString()}`);
      console.log('');
    });
  } catch (error) {
    console.log('  Error al listar usuarios:', error);
  }
}

async function getUserData(userId: string) {
  console.log(`\n📋 Datos del usuario ${userId}:\n`);
  
  const profileDoc = await db.doc(`users/${userId}/profile/data`).get();
  if (profileDoc.exists) {
    console.log('  Profile:', JSON.stringify(profileDoc.data(), null, 2));
  }
  
  const transactionsRef = db.collection(`users/${userId}/transactions`);
  const txSnapshot = await transactionsRef.limit(10).get();
  console.log(`  Transacciones: ${txSnapshot.size} documentos`);
  
  const goalDoc = await db.doc(`users/${userId}/goals/data`).get();
  if (goalDoc.exists) {
    console.log('  Goal:', JSON.stringify(goalDoc.data(), null, 2));
  }
  
  const categoriesRef = db.collection(`users/${userId}/categories`);
  const catSnapshot = await categoriesRef.get();
  console.log(`  Categorías: ${catSnapshot.size} documentos`);
}

async function createTestTransaction(userId: string) {
  console.log(`\n➕ Creando transacción de prueba...\n`);
  
  const docRef = db.collection(`users/${userId}/transactions`).doc();
  await docRef.set({
    amount: -50,
    categoryId: 'test-category',
    date: new Date().toISOString().split('T')[0],
    description: 'Test desde CLI',
    type: 'expense',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  console.log(`  ✅ Transacción creada: ${docRef.id}`);
}

async function createTestGoal(userId: string) {
  console.log(`\n🎯 Creando meta de prueba...\n`);
  
  await db.doc(`users/${userId}/goals/data`).set({
    name: 'Meta Test desde CLI',
    targetAmount: 5000,
    currentAmount: 100,
    monthlyContribution: 200,
    monthsToGoal: 25,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  console.log('  ✅ Meta creada/actualizada');
}

async function createTestCategories(userId: string) {
  console.log(`\n📂 Creando categorías de prueba...\n`);
  
  const categories = [
    { name: 'Test Alimentación', icon: '🍔', ruleType: 'need', budgetLimit: 200, isDefault: true },
    { name: 'Test Transporte', icon: '🚌', ruleType: 'need', budgetLimit: 100, isDefault: true },
    { name: 'Test Entretenimiento', icon: '🎬', ruleType: 'want', budgetLimit: 50, isDefault: true }
  ];
  
  for (const cat of categories) {
    const docRef = db.collection(`users/${userId}/categories`).doc();
    await docRef.set({ ...cat, id: docRef.id, createdAt: new Date().toISOString() });
    console.log(`  ✅ Categoría: ${cat.name}`);
  }
}

async function createProfile(userId: string) {
  console.log(`\n👤 Creando perfil del usuario...\n`);
  
  await db.doc(`users/${userId}/profile/data`).set({
    fullName: 'Alonso',
    email: 'alonsopicho@gmail.com',
    monthlyIncome: 1200,
    currency: 'PEN',
    locale: 'es-PE',
    createdAt: new Date().toISOString()
  });
  
  console.log('  ✅ Perfil creado');
}

async function deleteAllUserData(userId: string) {
  console.log(`\n🗑️ Eliminando todos los datos del usuario ${userId}...\n`);
  
  // Delete transactions
  const txRef = db.collection(`users/${userId}/transactions`);
  const txSnap = await txRef.get();
  const txBatch = db.batch();
  txSnap.docs.forEach(doc => txBatch.delete(doc.ref));
  await txBatch.commit();
  console.log(`  ✅ Transacciones eliminadas: ${txSnap.size}`);
  
  // Delete categories
  const catRef = db.collection(`users/${userId}/categories`);
  const catSnap = await catRef.get();
  const catBatch = db.batch();
  catSnap.docs.forEach(doc => catBatch.delete(doc.ref));
  await catBatch.commit();
  console.log(`  ✅ Categorías eliminadas: ${catSnap.size}`);
  
  // Delete goal
  await db.doc(`users/${userId}/goals/data`).delete().catch(() => {});
  console.log('  ✅ Goal eliminado');
  
  // Delete profile
  await db.doc(`users/${userId}/profile/data`).delete().catch(() => {});
  console.log('  ✅ Profile eliminado');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args[1];
  
  console.log('\n🔧 Firestore Admin CLI\n');
  console.log('Comandos disponibles:');
  console.log('  - list-collections   : Listar todas las colecciones');
  console.log('  - list-users         : Listar usuarios de Firebase Auth');
  console.log('  - get-user <uid>    : Ver datos de un usuario');
  console.log('  - create-profile <uid> : Crear perfil del usuario');
  console.log('  - create-tx <uid>    : Crear transacción de prueba');
  console.log('  - create-goal <uid>  : Crear meta de prueba');
  console.log('  - create-cats <uid>  : Crear categorías de prueba');
  console.log('  - delete-all <uid>   : Eliminar todos los datos del usuario\n');
  
  try {
    switch (command) {
      case 'list-collections':
        await listCollections();
        break;
      case 'list-users':
        await getUsers();
        break;
      case 'get-user':
        if (!param) console.log('⚠️  Necesitas especificar el UID');
        else await getUserData(param);
        break;
      case 'create-tx':
        if (!param) console.log('⚠️  Necesitas especificar el UID');
        else await createTestTransaction(param);
        break;
      case 'create-goal':
        if (!param) console.log('⚠️  Necesitas especificar el UID');
        else await createTestGoal(param);
        break;
      case 'create-cats':
        if (!param) console.log('⚠️  Necesitas especificar el UID');
        else await createTestCategories(param);
        break;
      case 'create-profile':
        if (!param) console.log('⚠️  Necesitas especificar el UID');
        else await createProfile(param);
        break;
      case 'delete-all':
        if (!param) console.log('⚠️  Necesitas especificar el UID');
        else await deleteAllUserData(param);
        break;
      default:
        console.log('Comando no reconocido. Ejecuta sin argumentos para ver ayuda.');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
  
  process.exit(0);
}

main();