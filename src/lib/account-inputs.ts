export type ProfileChanges = {
  title: string; firstName: string; lastName: string; email: string;
  streetName: string; city: string; zipcode: string;
  currentPassword: string; newPassword: string; newPasswordAgain: string;
};

export function validateProfileChanges(input: ProfileChanges): ProfileChanges {
  if (!input || typeof input !== 'object') throw new Error('Enter your profile details.');
  const output = {} as ProfileChanges;
  for (const key of ['title','firstName','lastName','email','streetName','city','zipcode','currentPassword','newPassword','newPasswordAgain'] as const) {
    if (typeof input[key] !== 'string' || input[key].length > 256) throw new Error('Check your profile details.');
    output[key] = key.includes('Password') ? input[key] : input[key].trim();
  }
  if (!output.currentPassword) throw new Error('Enter your current password to save changes.');
  if (output.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(output.email)) throw new Error('Enter a valid email address.');
  if (output.newPassword !== output.newPasswordAgain) throw new Error('The new passwords do not match.');
  return output;
}

export function validateBranchAmount(input: {amount: unknown}) {
  const amount = Number(input?.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a valid whole-number withdrawal amount.');
  return {amount};
}