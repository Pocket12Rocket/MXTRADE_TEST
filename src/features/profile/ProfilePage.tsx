import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import useAuth from '@/lib/useAuth';
import TermsAndConditionsModal from '@/features/auth/TermsAndConditionsModal';
import {
  useAcceptSellerTerms,
  useAcceptTerms,
  useUpdateMe,
  useUploadPhoto,
} from '@/lib/queries/account';
import { useMySellerProfile, useSaveSellerProfile } from '@/lib/queries/seller';
import {
  ACCOUNT_TYPE_OPTIONS,
  SELLER_STATUS_LABELS,
  SELLER_SUPPORT_EMAIL,
  type SellerProfileForm,
} from '@/lib/api/seller';
import { getFieldErrors } from '@/lib/apiClient';
import ImageCropDialog from '@/components/ImageCropDialog';
import { useImageCropQueue } from '@/lib/useImageCropQueue';
import CountryCodeSelect, {
  findPhoneCountry,
  isoForDialCode,
} from '@/components/CountryCodeSelect';
import { getPhoneError, sanitizePhoneInput } from '@/lib/phone';
import { AVATAR_IMAGE_ASPECT, AVATAR_IMAGE_OUTPUT_WIDTH } from '@/lib/cropImage';
import { toUserMessage } from '@/lib/userMessage';
import { useSingleFlight } from '@/lib/useSingleFlight';
import { BUYER_TERMS_VERSION, SELLER_TERMS_VERSION } from '@/features/auth/termsVersions';
import type { SellerProfile } from '@/lib/api/types';

/** The seller profile form: every field is a string while editing, `accountType` is '' until picked. */
interface SellerFormState {
  idNumber: string;
  streetAddress: string;
  suburb: string;
  city: string;
  postCode: string;
  bankName: string;
  accountType: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
}

const EMPTY_SELLER_PROFILE_FORM: SellerFormState = {
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

/**
 * Why: Turns a saved application into form values. The ID and account numbers are never
 * returned by the backend, so they always start empty and must be re-entered to save.
 * @param application - The `SellerProfile` from the backend, or null.
 * @returns Form values.
 * @example
 * const form = toSellerForm(sellerProfile);
 */
const toSellerForm = (application: SellerProfile | null | undefined): SellerFormState => ({
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

/**
 * Why: Page component for /profile; the signed-in profile only mounts once there is a user, so
 * its seller-profile query never fires for a signed-out visitor.
 * @returns The rendered page.
 * @example
 * // Rendered by the /profile route
 * <ProfilePage />
 */
export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Loading profile...</p>;
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Please sign in to view your profile.</p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800"
        >
          Log in
        </Link>
      </div>
    );
  }

  return <SignedInProfile />;
}

/**
 * Why: The profile card, avatar, terms and seller application for a signed-in user.
 * @returns The rendered profile.
 * @example
 * <SignedInProfile />
 */
function SignedInProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo upload state
  const { run: runUpload, pending: uploading } = useSingleFlight();
  const [uploadError, setUploadError] = useState('');

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCountryIso, setEditCountryIso] = useState('ZA');
  const [editPhoneError, setEditPhoneError] = useState('');
  const { run: runSave, pending: saving } = useSingleFlight();
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const updateMeMutation = useUpdateMe();
  const uploadPhotoMutation = useUploadPhoto();
  const acceptTermsMutation = useAcceptTerms();
  const acceptSellerTermsMutation = useAcceptSellerTerms();
  const saveSellerProfileMutation = useSaveSellerProfile();
  const sellerProfileQuery = useMySellerProfile();
  const sellerApplication = sellerProfileQuery.data ?? null;
  const sellerProfileLoading = sellerProfileQuery.isLoading;
  const sellerLoadError = sellerProfileQuery.error;
  const [sellerSaveError, setSellerProfileError] = useState('');
  const [sellerProfileSuccess, setSellerProfileSuccess] = useState('');
  const [isEditingSellerProfile, setIsEditingSellerProfile] = useState(false);
  // Why: unsaved edits sit on top of the saved application; null shows the saved values.
  const [sellerEdits, setSellerEdits] = useState<SellerFormState | null>(null);
  const sellerProfileForm = sellerEdits ?? toSellerForm(sellerApplication);
  const sellerProfileError =
    sellerSaveError ||
    (sellerLoadError
      ? toUserMessage(sellerLoadError, 'Could not load seller profile details.')
      : '');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [pendingTermsAction, setPendingTermsAction] = useState<'profile' | 'seller' | null>(null);
  const [showSellerTermsModal, setShowSellerTermsModal] = useState(false);
  const [hasAcceptedSellerTerms, setHasAcceptedSellerTerms] = useState(false);

  const currentPhoto = profile?.photoUrl || null;
  const initials = profile
    ? `${(profile.firstName || '').charAt(0)}${(profile.lastName || '').charAt(0)}`.toUpperCase()
    : '?';

  /**
   * Why: Switches the profile card into edit mode.
   */
  const openEdit = () => {
    setEditFirstName(profile?.firstName || '');
    setEditLastName(profile?.lastName || '');
    const iso = isoForDialCode(profile?.countryCode);
    setEditCountryIso(iso);
    setEditPhone(sanitizePhoneInput(profile?.phone || '', iso));
    setEditPhoneError('');
    setSaveError('');
    setSaveSuccess(false);
    setEditing(true);
  };

  /**
   * Why: Leaves edit mode and discards unsaved changes.
   */
  const cancelEdit = () => {
    setEditing(false);
    setSaveError('');
    setSaveSuccess(false);
  };

  /**
   * Why: Saves the basic profile details through the backend.
   */
  const saveBasicProfile = async () => {
    setSaveError('');
    const phoneProblem = getPhoneError(editPhone, editCountryIso);
    if (phoneProblem) {
      setEditPhoneError(phoneProblem);
      return;
    }
    try {
      // The backend returns the normalised Me, so store that rather than guessing locally.
      await updateMeMutation.mutateAsync({
        firstName: editFirstName,
        lastName: editLastName,
        phone: editPhone,
        countryCode: findPhoneCountry(editCountryIso).code,
      });
      setSaveSuccess(true);
      setEditing(false);
    } catch (err) {
      const fieldMessages = Object.values(getFieldErrors(err));
      setSaveError(
        fieldMessages.length > 0
          ? fieldMessages.join(' ')
          : toUserMessage(err, 'Failed to save changes. Please try again.'),
      );
    }
  };

  /**
   * Why: Validates and saves the profile edit form.
   * @param event - The form submit event.
   */
  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editFirstName.trim() || !editLastName.trim()) {
      setSaveError('First name and last name are required.');
      return;
    }

    if (hasAcceptedTermsOnce) {
      await runSave(saveBasicProfile);
      return;
    }

    setPendingTermsAction('profile');
    setHasAcceptedTerms(false);
    setShowTermsModal(true);
  };

  /**
   * Why: Uploads the avatar once the user has cropped it to a square; the cropper already
   * bounds it to 512px and the backend re-encodes it, so no client compression pass is needed.
   * @param croppedFile - The square-cropped image from `ImageCropDialog`.
   */
  const handleCroppedAvatar = async (croppedFile: File) => {
    setUploadError('');
    try {
      // The backend returns the updated Me, so no extra /me read is needed.
      await runUpload(async () => {
        await uploadPhotoMutation.mutateAsync(croppedFile);
      });
    } catch (err) {
      setUploadError(toUserMessage(err, 'Upload failed. Please try again.'));
    }
  };

  const avatarCropQueue = useImageCropQueue(handleCroppedAvatar);

  /**
   * Why: Validates the picked file type, then opens the square cropper for it.
   * @param event - The file input change event.
   */
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
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
   * Why: Updates one seller form field.
   * @param fieldName - The field name.
   * @param value - The new value.
   */
  const handleSellerFieldChange = (fieldName: keyof SellerFormState, value: string) => {
    setSellerEdits({ ...sellerProfileForm, [fieldName]: value });
  };

  /**
   * Why: Switches the seller profile card into edit mode.
   */
  const handleOpenSellerProfileEdit = () => {
    setSellerProfileError('');
    setSellerProfileSuccess('');
    setIsEditingSellerProfile(true);
  };

  /**
   * Why: Leaves seller profile edit mode and discards unsaved changes.
   */
  const handleCancelSellerProfileEdit = () => {
    setSellerProfileError('');
    setSellerProfileSuccess('');
    setSellerEdits(null);
    setIsEditingSellerProfile(false);
  };

  /**
   * Why: Saves the seller profile through the backend.
   */
  const saveSellerProfile = async () => {
    setSellerProfileError('');
    setSellerProfileSuccess('');

    try {
      // Why: the required-field check in `handleSellerProfileSubmit` guarantees `accountType` is set.
      const saved = await saveSellerProfileMutation.mutateAsync(
        sellerProfileForm as SellerProfileForm,
      );
      setSellerEdits(null);
      // Why: the backend decides sellerStatus/canSell (a bank or ID change sends an approved
      // seller back to review), so re-read /me rather than guessing locally.
      await refreshProfile();
      setSellerProfileSuccess(
        saved?.status === 'approved'
          ? 'Seller profile saved. Selling is enabled on your account.'
          : 'Seller profile saved.',
      );
      setIsEditingSellerProfile(false);
    } catch (error) {
      const fieldMessages = Object.values(getFieldErrors(error));
      setSellerProfileError(
        fieldMessages.length > 0
          ? fieldMessages.join(' ')
          : toUserMessage(error, 'Failed to save seller profile. Please try again.'),
      );
    }
  };

  /**
   * Why: Submits the seller application or the seller profile edit.
   * @param event - The form submit event.
   */
  const handleSellerProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const requiredFields: (keyof SellerFormState)[] = [
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

    const missingField = requiredFields.find(
      (fieldName) => !String(sellerProfileForm[fieldName] || '').trim(),
    );
    if (missingField) {
      setSellerProfileError('Please complete all seller profile fields before saving.');
      setSellerProfileSuccess('');
      return;
    }

    if (hasAcceptedSellerTermsOnce) {
      await runSave(saveSellerProfile);
      return;
    }

    setHasAcceptedSellerTerms(false);
    setShowSellerTermsModal(true);
  };

  /**
   * Why: Records the seller terms acceptance, then saves the seller profile.
   */
  const handleSellerTermsConfirm = async () => {
    if (!hasAcceptedSellerTerms) {
      return;
    }

    await runSave(async () => {
      setShowSellerTermsModal(false);
      setHasAcceptedSellerTerms(false);

      try {
        // The backend returns the updated Me, so no extra /me read is needed.
        await acceptSellerTermsMutation.mutateAsync(SELLER_TERMS_VERSION);
      } catch (err) {
        setSellerProfileError(
          toUserMessage(err, 'Could not record seller terms acceptance. Please try again.'),
        );
        return;
      }

      await saveSellerProfile();
    });
  };

  /**
   * Why: Records the buyer terms acceptance, then runs the action that was waiting on it.
   */
  const handleTermsConfirm = async () => {
    if (!hasAcceptedTerms) {
      return;
    }

    await runSave(async () => {
      setShowTermsModal(false);
      setPendingTermsAction(null);
      setHasAcceptedTerms(false);

      try {
        // The backend returns the updated Me, so no extra /me read is needed.
        await acceptTermsMutation.mutateAsync(BUYER_TERMS_VERSION);
      } catch (err) {
        const termsMessage = toUserMessage(
          err,
          'Could not record terms acceptance. Please try again.',
        );
        setSaveError(termsMessage);
        setSellerProfileError(termsMessage);
        return;
      }

      if (pendingTermsAction === 'profile') {
        await saveBasicProfile();
      }
    });
  };

  const sellerStatus = profile?.sellerStatus || 'none';
  const maskedAccountNumber = sellerApplication?.accountLast4
    ? `****${sellerApplication.accountLast4}`
    : 'Not set';
  const maskedIdNumber = sellerApplication?.idNumberLast4
    ? `Ending in ${sellerApplication.idNumberLast4}`
    : 'Not set';
  const accountTypeLabel =
    ACCOUNT_TYPE_OPTIONS.find((option) => option.value === sellerApplication?.accountType)?.label ||
    sellerApplication?.accountType ||
    'Not set';
  const hasCompletedSellerProfile = Boolean(sellerApplication);
  // Why: the backend flags when the accepted version is missing or out of date.
  const hasAcceptedTermsOnce =
    Boolean(profile?.termsAcceptedVersion) && !profile?.termsReacceptRequired;
  const hasAcceptedSellerTermsOnce =
    Boolean(profile?.sellerTermsAcceptedVersion) && !profile?.sellerTermsReacceptRequired;

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
              <span className="text-sm font-medium text-slate-700">
                First name <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:border-slate-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Last name <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:border-slate-400"
              />
            </label>
          </div>

          <div>
            <span className="text-sm font-medium text-slate-700">Contact number</span>
            <div className="flex gap-2">
              <CountryCodeSelect
                value={editCountryIso}
                onChange={(iso) => {
                  setEditCountryIso(iso);
                  setEditPhone((current) => sanitizePhoneInput(current, iso));
                  setEditPhoneError('');
                }}
              />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                aria-label="Mobile number"
                aria-invalid={editPhoneError ? true : undefined}
                value={editPhone}
                onChange={(e) => {
                  setEditPhone(sanitizePhoneInput(e.target.value, editCountryIso));
                  setEditPhoneError('');
                }}
                onBlur={() => setEditPhoneError(getPhoneError(editPhone, editCountryIso))}
                placeholder={editCountryIso === 'ZA' ? 'e.g. 821234567' : 'Phone number'}
                className={`mt-2 min-w-0 flex-1 rounded-3xl border px-4 py-3 focus:outline-none ${
                  editPhoneError
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200 bg-slate-50 focus:border-slate-400'
                }`}
              />
            </div>
            {editPhoneError ? <p className="mt-1 text-sm text-red-600">{editPhoneError}</p> : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Email address
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Email cannot be changed here. Contact support if needed.
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {profile?.email || user?.email}
            </p>
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
            <p className="mt-2 text-base font-semibold text-slate-900">
              {profile?.firstName} {profile?.lastName}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Email address
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {profile?.email || user?.email}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Contact number
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {profile?.phone ? `${profile.countryCode || ''} ${profile.phone}`.trim() : 'Not set'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Selling status
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {SELLER_STATUS_LABELS[sellerStatus] || SELLER_STATUS_LABELS.none}
            </p>
          </div>
        </div>
      )}

      {sellerStatus === 'suspended' && (
        <div className="py-2">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-rose-700">
            Selling suspended
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Your seller account has been suspended
          </h2>
          {sellerApplication?.suspensionReason ? (
            <p className="mt-3 text-slate-600">{sellerApplication.suspensionReason}</p>
          ) : null}
          <p className="mt-3 text-slate-600">
            Please contact{' '}
            <a href={`mailto:${SELLER_SUPPORT_EMAIL}`} className="font-semibold text-[#00C5CD]">
              {SELLER_SUPPORT_EMAIL}
            </a>{' '}
            to resolve this. Updating your details will not lift the suspension.
          </p>
        </div>
      )}

      {sellerStatus === 'none' && (
        <div className="py-2">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#00C5CD]">
            Next step
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Complete your seller profile
          </h2>
          <p className="mt-3 text-slate-600">
            To start selling on the marketplace, you'll need to complete your seller profile. The
            information requested is required to ensure the safety and security of both buyers and
            sellers, enable FastSport to securely distribute payments, and facilitate smooth product
            delivery. Once your details pass our automatic checks, selling is activated on your
            account straight away.
          </p>
          <p className="mt-4 text-slate-600">
            In the meantime, you can still browse the marketplace, search for products, add items to
            your cart, and manage your account using your basic profile.
          </p>
        </div>
      )}

      <div className="py-2">
        {sellerProfileLoading ? (
          <p className="text-sm text-slate-600">Loading seller profile...</p>
        ) : null}

        {!isEditingSellerProfile ? (
          <div className="space-y-4">
            {hasCompletedSellerProfile ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    ID Number
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{maskedIdNumber}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Street Address
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {sellerProfileForm.streetAddress || 'Not set'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Suburb
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {sellerProfileForm.suburb || 'Not set'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    City
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {sellerProfileForm.city || 'Not set'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Post Code
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {sellerProfileForm.postCode || 'Not set'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Bank Name
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {sellerProfileForm.bankName || 'Not set'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Account Type
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{accountTypeLabel}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Branch Name
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {sellerProfileForm.branchName || 'Not set'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Branch Code
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {sellerProfileForm.branchCode || 'Not set'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Account Number
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{maskedAccountNumber}</p>
                </div>
              </div>
            ) : null}

            {sellerProfileError ? (
              <p className="text-sm text-red-600">{sellerProfileError}</p>
            ) : null}
            {sellerProfileSuccess ? (
              <p className="text-sm text-emerald-700">{sellerProfileSuccess}</p>
            ) : null}

            <button
              type="button"
              onClick={handleOpenSellerProfileEdit}
              className="rounded-3xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {hasCompletedSellerProfile ? 'Edit seller profile' : 'Complete seller profile'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSellerProfileSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  ID Number
                  {sellerApplication?.idNumberLast4
                    ? ` (re-enter in full; saved number ends in ${sellerApplication.idNumberLast4})`
                    : ''}
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
                  onChange={(e) => handleSellerFieldChange('accountType', e.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <option value="">Select account type</option>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
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
                  onChange={(event) =>
                    handleSellerFieldChange('branchCode', event.target.value.replace(/\D/g, ''))
                  }
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Account Number
                  {sellerApplication?.accountLast4
                    ? ` (re-enter in full; saved number ends in ${sellerApplication.accountLast4})`
                    : ''}
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

            {sellerProfileError ? (
              <p className="text-sm text-red-600">{sellerProfileError}</p>
            ) : null}
            {sellerProfileSuccess ? (
              <p className="text-sm text-emerald-700">{sellerProfileSuccess}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-3xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? 'Saving seller profile...' : 'Save seller profile'}
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
          if (saving) return;
          setShowTermsModal(false);
          setPendingTermsAction(null);
          setHasAcceptedTerms(false);
        }}
        onConfirm={handleTermsConfirm}
        isChecked={hasAcceptedTerms}
        onCheckedChange={setHasAcceptedTerms}
        isSubmitting={saving}
        confirmLabel={
          pendingTermsAction === 'seller'
            ? 'I agree and save seller profile'
            : 'I agree and save profile'
        }
      />

      <TermsAndConditionsModal
        isOpen={showSellerTermsModal}
        onClose={() => {
          if (saving) return;
          setShowSellerTermsModal(false);
          setHasAcceptedSellerTerms(false);
        }}
        onConfirm={handleSellerTermsConfirm}
        isChecked={hasAcceptedSellerTerms}
        onCheckedChange={setHasAcceptedSellerTerms}
        isSubmitting={saving}
        confirmLabel="I agree and save seller profile"
        title="FastSport Seller Terms & Conditions"
        subtitle={`Effective Date: ${SELLER_TERMS_VERSION}`}
        mode="seller"
        checkboxLabel="I have read and agree to the seller terms and conditions"
      />
    </div>
  );
}
