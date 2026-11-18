import type { ReactNode } from 'react';
import type { Resource } from '../resource';
import Loading from './Loading';
import LoadError from './LoadError';
import NotFound from './NotFound';

export default function ResourceView<T>({
    resource,
    children,
}: {
    resource: Resource<T>;
    children: (data: T) => ReactNode;
}) {
    switch (resource.status) {
        case 'loading':
            return <Loading />;
        case 'error':
            return <LoadError onRetry={resource.retry} />;
        case 'missing':
            return <NotFound />;
        case 'ready':
            return children(resource.data);
    }
}
