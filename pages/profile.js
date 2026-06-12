import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useAuth from '../lib/useAuth';
import {
  fetchSellerPrivateProfile,
  upsertSellerPrivateProfile,
  uploadProfilePicture,
  updateUserProfile,
} from '../lib/firestoreHelpers';
import { compressImage } from '../lib/compressImage';

const COUNTRY_CODES = [
  { cc: 'US', code: '+1', name: 'United States' },
  { cc: 'CA', code: '+1', name: 'Canada' },
  { cc: 'GB', code: '+44', name: 'United Kingdom' },
  { cc: 'AU', code: '+61', name: 'Australia' },
  { cc: 'NZ', code: '+64', name: 'New Zealand' },
  { cc: 'ZA', code: '+27', name: 'South Africa' },
  { cc: 'NG', code: '+234', name: 'Nigeria' },
  { cc: 'KE', code: '+254', name: 'Kenya' },
  { cc: 'UG', code: '+256', name: 'Uganda' },
  { cc: 'MA', code: '+212', name: 'Morocco' },
  { cc: 'DZ', code: '+213', name: 'Algeria' },
  { cc: 'EG', code: '+20', name: 'Egypt' },
  { cc: 'AE', code: '+971', name: 'United Arab Emirates' },
  { cc: 'SA', code: '+966', name: 'Saudi Arabia' },
  { cc: 'QA', code: '+974', name: 'Qatar' },
  { cc: 'KH', code: '+855', name: 'Cambodia' },
  { cc: 'CN', code: '+86', name: 'China' },
  { cc: 'JP', code: '+81', name: 'Japan' },
  { cc: 'KR', code: '+82', name: 'South Korea' },
  { cc: 'SG', code: '+65', name: 'Singapore' },
  { cc: 'MY', code: '+60', name: 'Malaysia' },
  { cc: 'TH', code: '+66', name: 'Thailand' },
  { cc: 'ID', code: '+62', name: 'Indonesia' },
  { cc: 'PH', code: '+63', name: 'Philippines' },
  { cc: 'IN', code: '+91', name: 'India' },
  { cc: 'BD', code: '+880', name: 'Bangladesh' },
  { cc: 'PK', code: '+92', name: 'Pakistan' },
  { cc: 'FR', code: '+33', name: 'France' },
  { cc: 'DE', code: '+49', name: 'Germany' },
  { cc: 'IT', code: '+39', name: 'Italy' },
  { cc: 'ES', code: '+34', name: 'Spain' },
  { cc: 'NL', code: '+31', name: 'Netherlands' },
  { cc: 'BE', code: '+32', name: 'Belgium' },
  { cc: 'CH', code: '+41', name: 'Switzerland' },
  { cc: 'AT', code: '+43', name: 'Austria' },
  { cc: 'DK', code: '+45', name: 'Denmark' },
  { cc: 'SE', code: '+46', name: 'Sweden' },
  { cc: 'NO', code: '+47', name: 'Norway' },
  { cc: 'FI', code: '+358', name: 'Finland' },
  { cc: 'PL', code: '+48', name: 'Poland' },
  { cc: 'CZ', code: '+420', name: 'Czech Republic' },
  { cc: 'RO', code: '+40', name: 'Romania' },
  { cc: 'HU', code: '+36', name: 'Hungary' },
  { cc: 'GR', code: '+30', name: 'Greece' },
  { cc: 'PT', code: '+351', name: 'Portugal' },
  { cc: 'BR', code: '+55', name: 'Brazil' },
  { cc: 'AR', code: '+54', name: 'Argentina' },
  { cc: 'CL', code: '+56', name: 'Chile' },
  { cc: 'CO', code: '+57', name: 'Colombia' },
  { cc: 'PE', code: '+51', name: 'Peru' },
  { cc: 'UY', code: '+598', name: 'Uruguay' },
  { cc: 'MX', code: '+52', name: 'Mexico' },
];

const countryCodeToFlag = (cc) => {
  const codePoints = cc.toUpperCase().split('').map((char) => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
};

export default function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const fileInputRef = useRef(null);

  // Photo upload state
  const [photoURL, setPhotoURL] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCountryCode, setEditCountryCode] = useState('+27');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [sellerProfileLoading, setSellerProfileLoading] = useState(false);
  const [sellerProfileSaving, setSellerProfileSaving] = useState(false);
  const [sellerProfileError, setSellerProfileError] = useState('');
  const [sellerProfileSuccess, setSellerProfileSuccess] = useState('');
  const [isEditingSellerProfile, setIsEditingSellerProfile] = useState(false);
  const EMPTY_SELLER_PROFILE_FORM = {
    idNumber: '',
    streetAddress: '',
    suburb: '',
    city: '',
    postCode: '',
    bankName: '',
    accountType: '',
    branchName: '',
    branchCode: '',
    accountNumber: '',
  };
  const [sellerProfileForm, setSellerProfileForm] = useState(EMPTY_SELLER_PROFILE_FORM);
  const [savedSellerProfileForm, setSavedSellerProfileForm] = useState(EMPTY_SELLER_PROFILE_FORM);

  const currentPhoto = photoURL || profile?.photoURL || null;
  const initials = profile
    ? `${(profile.firstName || '').charAt(0)}${(profile.lastName || '').charAt(0)}`.toUpperCase()
    : '?';

  const openEdit = () => {
    setEditFirstName(profile?.firstName || '');
    setEditLastName(profile?.lastName || '');
    setEditPhone(profile?.phone || '');
    setEditCountryCode(profile?.countryCode || '+27');
    setSaveError('');
    setSaveSuccess(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSaveError('');
    setSaveSuccess(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editFirstName.trim() || !editLastName.trim()) {
      setSaveError('First name and last name are required.');
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      await updateUserProfile(user, {
        firstName: editFirstName,
        lastName: editLastName,
        phone: editPhone,
        countryCode: editCountryCode,
      });
      await refreshProfile(user);
      setSaveSuccess(true);
      setEditing(false);
    } catch {
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please select a JPG, PNG, WEBP, or GIF image.');
      return;
    }

    setUploadError('');
    setUploading(true);
    try {
      const optimizedFile = await compressImage(file, { maxSizeBytes: 5 * 1024 * 1024 });
      if (optimizedFile.size > 5 * 1024 * 1024) {
        setUploadError('Could not compress image under 5 MB. Please choose a smaller image.');
        return;
      }
      const url = await uploadProfilePicture(user, optimizedFile);
      await refreshProfile(user);
      setPhotoURL(url);
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  // Dismiss success banner after 4 seconds
  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 4000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    let isMounted = true;

    const loadSellerPrivateProfile = async () => {
      setSellerProfileLoading(true);
      setSellerProfileError('');
      try {
        const sellerPrivateProfile = await fetchSellerPrivateProfile(user.uid);
        if (!isMounted) {
          return;
        }

        const loadedSellerProfile = {
          idNumber: sellerPrivateProfile?.idNumber || '',
          streetAddress: sellerPrivateProfile?.streetAddress || '',
          suburb: sellerPrivateProfile?.suburb || '',
          city: sellerPrivateProfile?.city || '',
          postCode: sellerPrivateProfile?.postCode || '',
          bankName: sellerPrivateProfile?.bankName || '',
          accountType: sellerPrivateProfile?.accountType || '',
          branchName: sellerPrivateProfile?.branchName || '',
          branchCode: sellerPrivateProfile?.branchCode || '',
          accountNumber: sellerPrivateProfile?.accountNumber || '',
        };

        setSellerProfileForm(loadedSellerProfile);
        setSavedSellerProfileForm(loadedSellerProfile);
      } catch {
        if (isMounted) {
          setSellerProfileError('Could not load seller profile details.');
        }
      } finally {
        if (isMounted) {
          setSellerProfileLoading(false);
        }
      }
    };

    loadSellerPrivateProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const handleSellerFieldChange = (fieldName, value) => {
    setSellerProfileForm((currentValue) => ({
      ...currentValue,
      [fieldName]: value,
    }));
  };

  const handleOpenSellerProfileEdit = () => {
    setSellerProfileError('');
    setSellerProfileSuccess('');
    setIsEditingSellerProfile(true);
  };

  const handleCancelSellerProfileEdit = () => {
    setSellerProfileError('');
    setSellerProfileSuccess('');
    setSellerProfileForm(savedSellerProfileForm);
    setIsEditingSellerProfile(false);
  };

  const handleSellerProfileSubmit = async (event) => {
    event.preventDefault();

    const requiredFields = [
      'idNumber',
      'streetAddress',
      'suburb',
      'city',
      'postCode',
      'bankName',
      'accountType',
      'branchName',
      'branchCode',
      'accountNumber',
    ];

    const missingField = requiredFields.find((fieldName) => !String(sellerProfileForm[fieldName] || '').trim());
    if (missingField) {
      setSellerProfileError('Please complete all seller profile fields before saving.');
      setSellerProfileSuccess('');
      return;
    }

    setSellerProfileSaving(true);
    setSellerProfileError('');
    setSellerProfileSuccess('');

    try {
      await upsertSellerPrivateProfile(user, sellerProfileForm);
      await refreshProfile(user);
      setSavedSellerProfileForm(sellerProfileForm);
      setSellerProfileSuccess('Seller profile saved securely.');
      setIsEditingSellerProfile(false);
    } catch (error) {
      setSellerProfileError(error?.message || 'Failed to save seller profile.');
    } finally {
      setSellerProfileSaving(false);
    }
  };

  const maskedAccountNumber = sellerProfileForm.accountNumber
    ? `****${sellerProfileForm.accountNumber.slice(-4)}`
    : 'Not set';

  if (loading) {
    return <p>Loading profile...</p>;
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Please sign in to view your profile.</p>
        <Link href="/login" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Profile</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">My profile</h1>
          <p className="mt-3 text-slate-600">Your account is active. Selling permissions are managed separately from basic signup.</p>
          {/* Seller badge and trust score */}
          {profile?.canSell && (
            <div className="mt-3 flex items-center gap-3">
              {sellerProfileForm.sellerBadge === 'gold' && (
                <span title="Gold Seller" className="inline-flex items-center gap-1 rounded-full bg-yellow-400/80 px-2 py-0.5 text-xs font-bold text-yellow-900">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="9" /></svg>
                  Gold Seller
                </span>
              )}
              {sellerProfileForm.sellerBadge === 'platinum' && (
                <span title="Platinum Seller" className="inline-flex items-center gap-1 rounded-full bg-gray-300/80 px-2 py-0.5 text-xs font-bold text-gray-900">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="9" /></svg>
                  Platinum Seller
                </span>
              )}
              {typeof sellerProfileForm.sellerTrustScore === 'number' && (
                <span className="ml-2 text-xs font-semibold text-slate-700">Trust Score: {sellerProfileForm.sellerTrustScore}</span>
              )}
            </div>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={openEdit}
            className="mt-3 flex-shrink-0 inline-flex rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit profile
          </button>
        )}
      </div>

      {/* Save success banner */}
      {saveSuccess && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700">
          Profile updated successfully.
        </div>
      )}

      {/* Profile picture */}
      <div className="flex items-center gap-6">
        <div className="relative h-24 w-24 flex-shrink-0">
          {currentPhoto ? (
            <img
              src={currentPhoto}
              alt="Profile picture"
              className="h-24 w-24 rounded-full object-cover border-2 border-slate-200"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-200 text-2xl font-bold text-slate-500 border-2 border-slate-300">
              {initials}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <span className="text-xs font-semibold text-white">Uploading…</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Profile picture</p>
          <p className="text-xs text-slate-500">Optional. JPG, PNG, WEBP or GIF · Max 5 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {currentPhoto ? 'Change photo' : 'Upload photo'}
          </button>
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        </div>
      </div>

      {/* Edit form */}
      {editing ? (
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">First name <span className="text-red-500">*</span></span>
              <input
                type="text"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:border-slate-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Last name <span className="text-red-500">*</span></span>
              <input
                type="text"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:border-slate-400"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Contact number</span>
            <div className="mt-2 flex gap-2">
              <select
                value={editCountryCode}
                onChange={(e) => setEditCountryCode(e.target.value)}
                className="rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:border-slate-400"
              >
                {COUNTRY_CODES.map((country) => (
                  <option key={`${country.cc}-${country.code}`} value={country.code}>
                    {countryCodeToFlag(country.cc)} {country.code} {country.name}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Phone number"
                className="flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:border-slate-400"
              />
            </div>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Email address</p>
            <p className="mt-1 text-sm text-slate-500">Email cannot be changed here. Contact support if needed.</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{profile?.email || user.email}</p>
          </div>

          {saveError && <p className="text-sm text-red-500">{saveError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="inline-flex rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        /* Read-only view */
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Name</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{profile?.firstName} {profile?.lastName}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Email address</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{profile?.email || user.email}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Contact number</p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {profile?.phone ? `${profile.countryCode || ''} ${profile.phone}`.trim() : 'Not set'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Selling status</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{profile?.canSell ? 'Enabled' : 'Not enabled yet'}</p>
          </div>
        </div>
      )}

      {(!profile?.sellerProfileComplete || !profile?.canSell) && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-[#eceff3] p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#00C5CD]">Next step</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Complete your seller profile</h2>
          <p className="mt-3 text-slate-600">This profile page will be where you enter the additional information required to sell on the marketplace. Once that information is completed and approved, selling can be enabled on your account.</p>
          <p className="mt-4 text-sm text-slate-500">You can still browse, search, add items to cart, and manage your account with this basic profile.</p>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#00C5CD]">Seller profile details</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Sensitive verification information</h2>
        <p className="mt-2 text-sm text-slate-600">
          This information is stored in a private seller profile record and should be protected by Firestore security rules.
        </p>

        {sellerProfileLoading ? <p className="mt-4 text-sm text-slate-600">Loading seller profile...</p> : null}

        {!isEditingSellerProfile ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">ID Number</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{sellerProfileForm.idNumber || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Street Address</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{sellerProfileForm.streetAddress || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Suburb</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{sellerProfileForm.suburb || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">City</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{sellerProfileForm.city || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Post Code</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{sellerProfileForm.postCode || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Bank Name</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{sellerProfileForm.bankName || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Account Type</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{sellerProfileForm.accountType || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Branch Name</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{sellerProfileForm.branchName || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Branch Code</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{sellerProfileForm.branchCode || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Account Number</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{maskedAccountNumber}</p>
              </div>
            </div>

            {sellerProfileError ? <p className="text-sm text-red-600">{sellerProfileError}</p> : null}
            {sellerProfileSuccess ? <p className="text-sm text-emerald-700">{sellerProfileSuccess}</p> : null}

            <button
              type="button"
              onClick={handleOpenSellerProfileEdit}
              className="rounded-3xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {sellerProfileForm.idNumber ? 'Edit seller profile' : 'Complete seller profile'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSellerProfileSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">ID Number</span>
                <input
                  type="text"
                  value={sellerProfileForm.idNumber}
                  onChange={(event) => handleSellerFieldChange('idNumber', event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Street Address</span>
                <input
                  type="text"
                  value={sellerProfileForm.streetAddress}
                  onChange={(event) => handleSellerFieldChange('streetAddress', event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Suburb</span>
                <input
                  type="text"
                  value={sellerProfileForm.suburb}
                  onChange={(event) => handleSellerFieldChange('suburb', event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">City</span>
                <input
                  type="text"
                  value={sellerProfileForm.city}
                  onChange={(event) => handleSellerFieldChange('city', event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Post Code</span>
                <input
                  type="text"
                  value={sellerProfileForm.postCode}
                  onChange={(event) => handleSellerFieldChange('postCode', event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>

              <div />


              <label className="block">
                <span className="text-sm font-medium text-slate-700">Bank Name</span>
                <input
                  type="text"
                  value={sellerProfileForm.bankName}
                  onChange={(event) => handleSellerFieldChange('bankName', event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Account Type</span>
                <select
                  value={sellerProfileForm.accountType || ''}
                  onChange={e => handleSellerFieldChange('accountType', e.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <option value="">Select account type</option>
                  <option value="Current/Cheque">Current/Cheque</option>
                  <option value="Savings">Savings</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Branch Name</span>
                <input
                  type="text"
                  value={sellerProfileForm.branchName}
                  onChange={(event) => handleSellerFieldChange('branchName', event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Branch Code</span>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={sellerProfileForm.branchCode}
                  onChange={(event) => handleSellerFieldChange('branchCode', event.target.value.replace(/\D/g, ''))}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Account Number</span>
                <input
                  type="text"
                  value={sellerProfileForm.accountNumber}
                  onChange={(event) => handleSellerFieldChange('accountNumber', event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>
            </div>

            {sellerProfileError ? <p className="text-sm text-red-600">{sellerProfileError}</p> : null}
            {sellerProfileSuccess ? <p className="text-sm text-emerald-700">{sellerProfileSuccess}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={sellerProfileSaving}
                className="rounded-3xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {sellerProfileSaving ? 'Saving seller profile...' : 'Save seller profile'}
              </button>
              <button
                type="button"
                onClick={handleCancelSellerProfileEdit}
                className="rounded-3xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}