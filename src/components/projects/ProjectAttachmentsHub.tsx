/**
 * ProjectAttachmentsHub Component (SSOT Re-export & Hub Wrapper)
 */
import React from 'react';
import { ProjectDocumentsTab } from '../ProjectDocumentsTab';
import { Project, SupplierQuotation, ProjectDocument } from '../../types';

export interface ProjectAttachmentsHubProps {
  project: Project;
  supplierQuotations?: SupplierQuotation[];
  onUpdateProjectDocuments?: (projectId: string, documents: ProjectDocument[]) => void;
  onUpdateMasterDriveUrl?: (projectId: string, url: string) => void;
  onViewSupplierQuote?: (supplierQuote: SupplierQuotation) => void;
  onOpenUploadSupplierModal?: (projectId: string) => void;
}

export const ProjectAttachmentsHub: React.FC<ProjectAttachmentsHubProps> = (props) => {
  return <ProjectDocumentsTab {...props} />;
};

export default ProjectAttachmentsHub;
