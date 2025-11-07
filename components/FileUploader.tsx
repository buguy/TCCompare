import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons';

interface FileUploaderProps {
  id: string;
  label: string;
  onFileSelect: (file: File) => void;
  fileName: string | null | undefined;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ id, label, onFileSelect, fileName }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };
  
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);


  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <label
        htmlFor={id}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex justify-center items-center w-full h-32 px-6 py-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ease-in-out
          ${isDragging ? 'border-[#4A70A9] bg-[#4A70A9]/10' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}`}
      >
        <div className="text-center">
            <UploadIcon className="mx-auto h-8 w-8 text-gray-400"/>
            {fileName ? (
                <p className="mt-2 text-sm text-gray-800 font-semibold break-all">{fileName}</p>
            ) : (
                <>
                    <p className="mt-2 text-sm text-gray-600">
                    <span className="font-semibold text-[#4A70A9]">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">.HTML</p>
                </>
            )}
        </div>
        <input id={id} name={id} type="file" className="sr-only" onChange={handleFileChange} accept=".html"/>
      </label>
    </div>
  );
};