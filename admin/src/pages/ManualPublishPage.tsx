import React, { useState, useCallback, useEffect } from 'react';
import {
  Main,
  Box,
  Typography,
  TextInput,
  Button,
  Grid,
  Field,
  DateTimePicker,
  SingleSelect,
  SingleSelectOption,
  Alert,
  Flex,
  Divider,
} from '@strapi/design-system';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { PLUGIN_ID } from '../pluginId';

interface ContentTypeInfo {
  uid: string;
  displayName: string;
  hasDraftAndPublish: boolean;
}

const ManualPublishPage: React.FC = () => {
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [contentTypes, setContentTypes] = useState<ContentTypeInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [documentId, setDocumentId] = useState('');
  const [slug, setSlug] = useState('');
  const locale = 'en';
  const [firstPublishedAt, setFirstPublishedAt] = useState<Date | undefined>(undefined);
  const [currentValue, setCurrentValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch content types with draftAndPublish enabled
  useEffect(() => {
    const fetchContentTypes = async () => {
      try {
        const { data } = await get(`/${PLUGIN_ID}/content-types`);
        setContentTypes(data || []);
      } catch (err) {
        console.error('Failed to fetch content types:', err);
      }
    };
    fetchContentTypes();
  }, [get]);

  // Look up document by slug
  const handleSlugLookup = useCallback(async () => {
    if (!selectedCollection || !slug) return;

    setLookupLoading(true);
    setError(null);

    try {
      const { data } = await get(
        `/${PLUGIN_ID}/lookup?uid=${encodeURIComponent(selectedCollection)}&slug=${encodeURIComponent(slug)}&locale=${encodeURIComponent(locale)}`
      );

      if (data?.documentId) {
        setDocumentId(data.documentId);
        if (data.firstPublishedAt) {
          setCurrentValue(data.firstPublishedAt);
          setFirstPublishedAt(new Date(data.firstPublishedAt));
        } else {
          setCurrentValue(null);
        }
        setSuccess(`Found document: ${data.documentId}`);
      } else {
        setError('No document found with that slug.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Lookup failed');
    } finally {
      setLookupLoading(false);
    }
  }, [selectedCollection, slug, locale, get]);

  // Fetch current firstPublishedAt when documentId is provided
  const handleFetchCurrent = useCallback(async () => {
    if (!selectedCollection || !documentId) return;

    setError(null);
    try {
      const { data } = await get(
        `/${PLUGIN_ID}/lookup?uid=${encodeURIComponent(selectedCollection)}&documentId=${encodeURIComponent(documentId)}&locale=${encodeURIComponent(locale)}`
      );

      if (data?.firstPublishedAt) {
        setCurrentValue(data.firstPublishedAt);
        setFirstPublishedAt(new Date(data.firstPublishedAt));
      } else {
        setCurrentValue(null);
      }
    } catch {
      // silently fail
    }
  }, [selectedCollection, documentId, locale, get]);

  // Submit update
  const handleSubmit = useCallback(async () => {
    if (!selectedCollection || !documentId || !firstPublishedAt) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await put(`/${PLUGIN_ID}/update`, {
        uid: selectedCollection,
        documentId,
        locale,
        firstPublishedAt: firstPublishedAt.toISOString(),
      });

      setSuccess('firstPublishedAt updated successfully!');
      setCurrentValue(firstPublishedAt.toISOString());

      toggleNotification({
        type: 'success',
        message: 'firstPublishedAt updated successfully!',
      });
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message || 'Failed to update firstPublishedAt';
      setError(message);

      toggleNotification({
        type: 'danger',
        message,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedCollection, documentId, locale, firstPublishedAt, put, toggleNotification]);

  return (
    <Main>
      <Box padding={8} background="neutral100">
        <Box paddingBottom={4}>
          <Typography variant="alpha" tag="h1">
            Update First Published At
          </Typography>
          <Box paddingTop={2}>
            <Typography variant="epsilon" textColor="neutral600">
              Manually set the firstPublishedAt date for any content entry with Draft &amp; Publish
              enabled. This is useful for backdating migrated content.
            </Typography>
          </Box>
        </Box>

        <Divider />

        <Box paddingTop={6}>
          {error && (
            <Box paddingBottom={4}>
              <Alert variant="danger" onClose={() => setError(null)} closeLabel="Close">
                {error}
              </Alert>
            </Box>
          )}

          {success && (
            <Box paddingBottom={4}>
              <Alert variant="success" onClose={() => setSuccess(null)} closeLabel="Close">
                {success}
              </Alert>
            </Box>
          )}

          <Box background="neutral0" padding={6} shadow="filterShadow" hasRadius>
            <Grid.Root gap={4}>
              {/* Collection Select */}
              <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                <Field.Root width="100%">
                  <Field.Label>Collection (Content-Type UID)</Field.Label>
                  <SingleSelect
                    placeholder="Select a collection"
                    value={selectedCollection}
                    onChange={(value: string | number) => {
                      setSelectedCollection(String(value));
                      setDocumentId('');
                      setSlug('');
                      setCurrentValue(null);
                      setFirstPublishedAt(undefined);
                    }}
                  >
                    {contentTypes.map((ct) => (
                      <SingleSelectOption key={ct.uid} value={ct.uid}>
                        {ct.displayName} ({ct.uid})
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                  <Field.Hint />
                </Field.Root>
              </Grid.Item>

              {/* Slug Lookup */}
              <Grid.Item col={8} s={12} direction="column" alignItems="stretch">
                <Field.Root width="100%">
                  <Field.Label>Look up by Slug (optional)</Field.Label>
                  <TextInput
                    placeholder="Enter slug to find document ID"
                    value={slug}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSlug(e.target.value)
                    }
                  />
                </Field.Root>
              </Grid.Item>

              <Grid.Item col={4} s={12} direction="column" alignItems="flex-end">
                <Box paddingTop={5}>
                  <Button
                    variant="secondary"
                    onClick={handleSlugLookup}
                    loading={lookupLoading}
                    disabled={!selectedCollection || !slug}
                    fullWidth
                  >
                    Look Up
                  </Button>
                </Box>
              </Grid.Item>

              {/* Document ID */}
              <Grid.Item col={8} s={12} direction="column" alignItems="stretch">
                <Field.Root width="100%">
                  <Field.Label>Document ID *</Field.Label>
                  <TextInput
                    placeholder="Enter the document ID"
                    value={documentId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDocumentId(e.target.value)
                    }
                  />
                </Field.Root>
              </Grid.Item>

              <Grid.Item col={4} s={12} direction="column" alignItems="flex-end">
                <Box paddingTop={5}>
                  <Button
                    variant="secondary"
                    onClick={handleFetchCurrent}
                    disabled={!selectedCollection || !documentId}
                    fullWidth
                  >
                    Fetch Current
                  </Button>
                </Box>
              </Grid.Item>

              {/* Current Value Display */}
              {currentValue && (
                <Grid.Item col={12} direction="column">
                  <Box padding={3} background="primary100" hasRadius>
                    <Typography variant="omega" textColor="primary700">
                      Current firstPublishedAt:{' '}
                      <strong>{new Date(currentValue).toLocaleString()}</strong>
                    </Typography>
                  </Box>
                </Grid.Item>
              )}

              {/* Date Picker */}
              <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                <Field.Root width="100%">
                  <Field.Label>New First Published At *</Field.Label>
                  <DateTimePicker
                    value={firstPublishedAt}
                    onChange={(date: Date | undefined) => setFirstPublishedAt(date)}
                    clearLabel="Clear"
                  />
                  <Field.Hint />
                </Field.Root>
              </Grid.Item>

              {/* Submit */}
              <Grid.Item col={12} direction="column">
                <Box paddingTop={4}>
                  <Flex justifyContent="flex-end">
                    <Button
                      onClick={handleSubmit}
                      loading={loading}
                      disabled={!selectedCollection || !documentId || !firstPublishedAt}
                      size="L"
                    >
                      Update First Published At
                    </Button>
                  </Flex>
                </Box>
              </Grid.Item>
            </Grid.Root>
          </Box>
        </Box>
      </Box>
    </Main>
  );
};

export default ManualPublishPage;
