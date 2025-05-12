const { 
        files: fetchedFiles, progress, error: fetchErrorHook, 
        handleFetchManual, 
        loading: isFetchLoading = false, // <<< Вот это присвоение по умолчанию
        isFetchDisabled,
        maxRetries: hookMaxRetries 
    } = repoFetcher;