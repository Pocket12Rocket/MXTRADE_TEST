import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useAuth from '../lib/useAuth';
import { useAuthContext } from '../lib/AuthContext';
import TermsAndConditionsModal from '../components/TermsAndConditionsModal';
import {
  uploadProfilePicture,
  updateUserProfile,
} from '../lib/firestoreHelpers';
import {
  ACCOUNT_TYPE_OPTIONS,
  SELLER_STATUS_LABELS,
  fetchMySellerProfile,
  saveMySellerProfile,
} from '../lib/api/seller';
import { getFieldErrors } from '../lib/apiClient';
import ImageCropDialog from '../components/ImageCropDialog';
import { useImageCropQueue } from '../lib/useImageCropQueue';
import { AVATAR_IMAGE_ASPECT, AVATAR_IMAGE_OUTPUT_WIDTH } from '../lib/cropImage';
import { toUserMessage } from '../lib/userMessage';
import { acceptSellerTerms, acceptTerms } from '../lib/api/auth';
import { BUYER_TERMS_VERSION, SELLER_TERMS_VERSION } from '../lib/termsVersions';

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
  // updateProfileLocal isn't part of useAuth()'s public return shape (kept identical to
  // avoid touching other consumers) — read it straight from the shared context here so
  // known-payload saves below can skip an extra /me read.
  const { updateProfileLocal } = useAuthContext();
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
  // Why: the saved application from the backend: status, rejection reason and the last 4 digits
  // of the ID and account numbers (the full numbers are never returned).
  const [sellerApplication, setSellerApplication] = useState(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [pendingTermsAction, setPendingTermsAction] = useState(null);
  const [showSellerTermsModal, setShowSellerTermsModal] = useState(false);
  const [hasAcceptedSellerTerms, setHasAcceptedSellerTerms] = useState(false);

  const currentPhoto = photoURL || profile?.photoUrl || null;
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

  const saveBasicProfile = async () => {
    setSaveError('');
    setSaving(true);
    try {
      await updateUserProfile(user, {
        firstName: editFirstName,
        lastName: editLastName,
        phone: editPhone,
        countryCode: editCountryCode,
      });
      // Write payload is known (mirrors updateUserProfile's own normalization), so
      // update the shared profile locally instead of re-reading users/{uid} (PERF-18).
      const trimmedFirstName = editFirstName.trim();
      const trimmedLastName = editLastName.trim();
      updateProfileLocal({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        displayName: `${trimmedFirstName} ${trimmedLastName}`.trim(),
        phone: editPhone.trim(),
        countryCode: (editCountryCode || '+27').trim(),
      });
      setSaveSuccess(true);
      setEditing(false);
    } catch {
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editFirstName.trim() || !editLastName.trim()) {
      setSaveError('First name and last name are required.');
      return;
    }

    if (hasAcceptedTermsOnce) {
      await saveBasicProfile();
      return;
    }

    setPendingTermsAction('profile');
    setHasAcceptedTerms(false);
    setShowTermsModal(true);
  };

  /**
   * Why: Uploads the avatar once the user has cropped it to a square; the cropper already
   * bounds it to 512px, so no separate compression pass is needed.
   * @param {File} croppedFile - The square-cropped image from `ImageCropDialog`.
   * @returns {Promise<void>}
   */
  const handleCroppedAvatar = async (croppedFile) => {
    setUploadError('');
    setUploading(true);
    try {
      const url = await uploadProfilePicture(user, croppedFile);
      // The upload returns the new URL, so update locally instead of re-reading /me.
      updateProfileLocal({ photoUrl: url });
      setPhotoURL(url);
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const avatarCropQueue = useImageCropQueue(handleCroppedAvatar);

  /**
   * Why: Validates the picked file type, then opens the square cropper for it.
   * @param {Event} event - The file input change event.
   * @returns {void}
   */
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please select a JPG, PNG, WEBP, or GIF image.');
      return;
    }

    setUploadError('');
    avatarCropQueue.enqueue([file]);
  };

  // Dismiss success banner after 4 seconds
  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 4000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  /**
   * Why: Turns a saved application into form values. The ID and account numbers are never
   * returned by the backend, so they always start empty and must be re-entered to save.
   * @param {object|null} application - The `SellerProfile` from the backend, or null.
   * @returns {object} Form values.
   */
  const toSellerForm = (application) => ({
    ...EMPTY_SELLER_PROFILE_FORM,
    streetAddress: application?.streetAddress || '',
    suburb: application?.suburb || '',
    city: application?.city || '',
    postCode: application?.postCode || '',
    bankName: application?.bankName || '',
    accountType: application?.accountType || '',
    branchName: application?.branchName || '',
    branchCode: application?.branchCode || '',
  });

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let isMounted = true;

    const loadSellerApplication = async () => {
      setSellerProfileLoading(true);
      setSellerProfileError('');
      try {
        const application = await fetchMySellerProfile();
        if (!isMounted) {
          return;
        }

        const loadedSellerProfile = toSellerForm(application);
        setSellerApplication(application);
        setSellerProfileForm(loadedSellerProfile);
        setSavedSellerProfileForm(loadedSellerProfile);
      } catch (err) {
        if (isMounted) {
          setSellerProfileError(toUserMessage(err, 'Could not load seller profile details.'));
        }
      } finally {
        if (isMounted) {
          setSellerProfileLoading(false);
        }
      }
    };

    loadSellerApplication();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

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

  const saveSellerProfile = async () => {
    setSellerProfileSaving(true);
    setSellerProfileError('');
    setSellerProfileSuccess('');

    try {
      const saved = await saveMySellerProfile(sellerProfileForm);
      const savedForm = toSellerForm(saved);
      setSellerApplication(saved);
      setSellerProfileForm(savedForm);
      setSavedSellerProfileForm(savedForm);
      // Why: the backend decides sellerStatus/canSell (a bank or ID change sends an approved
      // seller back to review), so re-read /me rather than guessing locally.
      await refreshProfile();
      setSellerProfileSuccess(saved?.status === 'approved'
        ? 'Seller profile saved securely.'
        : 'Seller application submitted. We will email you once it has been reviewed.');
      setIsEditingSellerProfile(false);
    } catch (error) {
      const fieldMessages = Object.values(getFieldErrors(error));
      setSellerProfileError(fieldMessages.length > 0
        ? fieldMessages.join(' ')
        : toUserMessage(error, 'Failed to save seller profile. Please try again.'));
    } finally {
      setSellerProfileSaving(false);
    }
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

    if (hasAcceptedSellerTermsOnce) {
      await saveSellerProfile();
      return;
    }

    setHasAcceptedSellerTerms(false);
    setShowSellerTermsModal(true);
  };

  const handleSellerTermsConfirm = async () => {
    if (!hasAcceptedSellerTerms) {
      return;
    }

    setShowSellerTermsModal(false);
    setHasAcceptedSellerTerms(false);

    try {
      // The backend returns the updated Me, so no extra /me read is needed.
      updateProfileLocal(await acceptSellerTerms(SELLER_TERMS_VERSION));
    } catch (err) {
      setSellerProfileError(toUserMessage(err, 'Could not record seller terms acceptance. Please try again.'));
      return;
    }

    await saveSellerProfile();
  };

  const handleTermsConfirm = async () => {
    if (!hasAcceptedTerms) {
      return;
    }

    setShowTermsModal(false);
    setPendingTermsAction(null);
    setHasAcceptedTerms(false);

    try {
      // The backend returns the updated Me, so no extra /me read is needed.
      updateProfileLocal(await acceptTerms(BUYER_TERMS_VERSION));
    } catch (err) {
      const termsMessage = toUserMessage(err, 'Could not record terms acceptance. Please try again.');
      setSaveError(termsMessage);
      setSellerProfileError(termsMessage);
      return;
    }

    if (pendingTermsAction === 'profile') {
      await saveBasicProfile();
    }
  };

  const sellerStatus = profile?.sellerStatus || 'none';
  const maskedAccountNumber = sellerApplication?.accountLast4 ? `****${sellerApplication.accountLast4}` : 'Not set';
  const maskedIdNumber = sellerApplication?.idNumberLast4 ? `Ending in ${sellerApplication.idNumberLast4}` : 'Not set';
  const accountTypeLabel = ACCOUNT_TYPE_OPTIONS.find((option) => option.value === sellerApplication?.accountType)?.label
    || sellerApplication?.accountType || 'Not set';
  const hasCompletedSellerProfile = Boolean(sellerApplication);
  // Why: the backend flags when the accepted version is missing or out of date.
  const hasAcceptedTermsOnce = Boolean(profile?.termsAcceptedVersion) && !profile?.termsReacceptRequired;
  const hasAcceptedSellerTermsOnce = Boolean(profile?.sellerTermsAcceptedVersion) && !profile?.sellerTermsReacceptRequired;

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
      <ImageCropDialog
        file={avatarCropQueue.currentFile}
        aspect={AVATAR_IMAGE_ASPECT}
        maxWidth={AVATAR_IMAGE_OUTPUT_WIDTH}
        cropShape="round"
        title="Crop profile picture"
        onConfirm={avatarCropQueue.confirm}
        onSkip={avatarCropQueue.skip}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Profile</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">My profile</h1>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={openEdit}
            className="mt-3 inline-flex flex-shrink-0 rounded-full border border-[#00CED1] bg-[#00C5CD] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#00b7be]"
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
            <p className="mt-2 text-base font-semibold text-slate-900">{SELLER_STATUS_LABELS[sellerStatus] || SELLER_STATUS_LABELS.none}</p>
          </div>
        </div>
      )}

      {sellerStatus === 'pending' && (
        <div className="py-2">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#00C5CD]">Under review</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Your seller application is being reviewed</h2>
          <p className="mt-3 text-slate-600">We will email you once an admin has reviewed your details. You can keep browsing and buying in the meantime.</p>
        </div>
      )}

      {sellerStatus === 'rejected' && (
        <div className="py-2">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-rose-700">Not approved</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Your seller application needs changes</h2>
          <p className="mt-3 text-slate-600">{sellerApplication?.rejectionReason || 'Please review your details and resubmit.'}</p>
        </div>
      )}

      {sellerStatus === 'none' && (
        <div className="py-2">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#00C5CD]">Next step</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Complete your seller profile</h2>
          <p className="mt-3 text-slate-600">To start selling on the marketplace, you'll need to complete your seller profile. The information requested is required to ensure the safety and security of both buyers and sellers, enable FastSport to securely distribute payments, and facilitate smooth product delivery. Once your profile has been completed and approved, selling will be activated on your account.</p>
          <p className="mt-4 text-slate-600">In the meantime, you can still browse the marketplace, search for products, add items to your cart, and manage your account using your basic profile.</p>
        </div>
      )}

      <div className="py-2">
        {sellerProfileLoading ? <p className="text-sm text-slate-600">Loading seller profile...</p> : null}

        {!isEditingSellerProfile ? (
          <div className="space-y-4">
            {hasCompletedSellerProfile ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">ID Number</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{maskedIdNumber}</p>
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
                  <p className="mt-2 text-sm font-semibold text-slate-900">{accountTypeLabel}</p>
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
            ) : null}

            {sellerProfileError ? <p className="text-sm text-red-600">{sellerProfileError}</p> : null}
            {sellerProfileSuccess ? <p className="text-sm text-emerald-700">{sellerProfileSuccess}</p> : null}

            <button
              type="button"
              onClick={handleOpenSellerProfileEdit}
              className="rounded-3xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {sellerStatus === 'rejected' ? 'Update and resubmit' : (hasCompletedSellerProfile ? 'Edit seller profile' : 'Complete seller profile')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSellerProfileSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  ID Number{sellerApplication?.idNumberLast4 ? ` (re-enter in full; saved number ends in ${sellerApplication.idNumberLast4})` : ''}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
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
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
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
                <span className="text-sm font-medium text-slate-700">
                  Account Number{sellerApplication?.accountLast4 ? ` (re-enter in full; saved number ends in ${sellerApplication.accountLast4})` : ''}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
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

      <TermsAndConditionsModal
        isOpen={showTermsModal}
        onClose={() => {
          if (saving || sellerProfileSaving) return;
          setShowTermsModal(false);
          setPendingTermsAction(null);
          setHasAcceptedTerms(false);
        }}
        onConfirm={handleTermsConfirm}
        isChecked={hasAcceptedTerms}
        onCheckedChange={setHasAcceptedTerms}
        isSubmitting={saving || sellerProfileSaving}
        confirmLabel={pendingTermsAction === 'seller' ? 'I agree and save seller profile' : 'I agree and save profile'}
      />

      <TermsAndConditionsModal
        isOpen={showSellerTermsModal}
        onClose={() => {
          if (sellerProfileSaving) return;
          setShowSellerTermsModal(false);
          setHasAcceptedSellerTerms(false);
        }}
        onConfirm={handleSellerTermsConfirm}
        isChecked={hasAcceptedSellerTerms}
        onCheckedChange={setHasAcceptedSellerTerms}
        isSubmitting={sellerProfileSaving}
        confirmLabel="I agree and save seller profile"
        title="FastSport Seller Terms & Conditions"
        subtitle={`Effective Date: ${SELLER_TERMS_VERSION}`}
        mode="seller"
        checkboxLabel="I have read and agree to the seller terms and conditions"
      />
    </div>
  );
}