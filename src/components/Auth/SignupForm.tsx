import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

interface SignupFormProps {
  onToggleForm: () => void;
}

export default function SignupForm({ onToggleForm }: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password);
      toast.success('Account created successfully! Please log in.');
      onToggleForm();
    } catch (error) {
      toast.error('Error creating account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-[#1b2733] p-8 rounded-lg border border-[#2c3b47] shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <UserPlus className="w-6 h-6 text-[#00e701]" />
          <h2 className="text-2xl font-bold">Create Account</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#8b9caa] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0f1923] text-white p-3 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8b9caa] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0f1923] text-white p-3 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8b9caa] mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#0f1923] text-white p-3 rounded-lg border border-[#2c3b47] focus:border-[#00e701] focus:ring-1 focus:ring-[#00e701] transition-all"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00e701] hover:bg-[#00c701] text-[#0f1923] font-bold py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-[#8b9caa]">
          Already have an account?{' '}
          <button
            onClick={onToggleForm}
            className="text-[#00e701] hover:underline"
          >
            Log in
          </button>
        </p>
      </div>
    </div>
  );
}