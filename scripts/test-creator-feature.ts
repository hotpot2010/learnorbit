import { isCreatorEmail, generateCourseSlug } from '../src/lib/creator-utils';

console.log('🧪 Testing Creator Feature Utils...\n');

// Test isCreatorEmail function
console.log('Testing isCreatorEmail:');
console.log('zhouletao20@gmail.com:', isCreatorEmail('zhouletao20@gmail.com')); // should be true
console.log('ritafeng1234@gmail.com:', isCreatorEmail('ritafeng1234@gmail.com')); // should be true
console.log('regular@user.com:', isCreatorEmail('regular@user.com')); // should be false
console.log('ZHOULETAO20@GMAIL.COM:', isCreatorEmail('ZHOULETAO20@GMAIL.COM')); // should be true (case insensitive)

console.log('\nTesting generateCourseSlug:');
const testTitle = 'Can I Learn AI Without Coding?';
const testUserId = 'user123';

console.log('Creator slug:', generateCourseSlug(testTitle, testUserId, true));
// should be: can-i-learn-ai-without-coding

console.log('Regular user slug:', generateCourseSlug(testTitle, testUserId, false));
// should be: can-i-learn-ai-without-coding-user123

console.log('\n✅ All tests completed!');
