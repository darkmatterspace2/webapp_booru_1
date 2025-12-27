        if (articleData.tags && Array.isArray(articleData.tags)) {
            articleData.tags = articleData.tags.map(tag => {
                return tag
                    .trim()                           // Remove leading/trailing whitespace
                    .toLowerCase()                    // Force lowercase
                    .replace(/\s+/g, '_')             // Replace spaces with underscores
                    .replace(/[!@#$%^&*()+=\[\]{};:'",.<>?\\|`~]/g, ''); // Strip special symbols
            }).filter(tag => tag.length > 0);         // Remove empty tags
        }