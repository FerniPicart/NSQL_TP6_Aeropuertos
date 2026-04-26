import type { ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  title: string
  message: ReactNode
  type?: 'info' | 'success' | 'error' | 'confirm'
  onClose?: () => void
  onConfirm?: () => void
  confirmText?: string
  cancelText?: string
}

export default function Modal({
  isOpen,
  title,
  message,
  type = 'info',
  onClose,
  onConfirm,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar'
}: ModalProps) {
  if (!isOpen) {
    return null
  }

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'confirm':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
  }

  const getButtonColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 hover:bg-green-700'
      case 'error':
        return 'bg-red-600 hover:bg-red-700'
      case 'confirm':
        return 'bg-blue-600 hover:bg-blue-700'
      default:
        return 'bg-gray-600 hover:bg-gray-700'
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'error':
        return (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'confirm':
        return (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="rounded-lg bg-white p-6 shadow-xl" style={{ maxWidth: '90%', width: '500px' }}>
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 ${getIconColor()}`}>{getIcon()}</div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>

        <p className="mt-4 text-sm text-gray-700">{message}</p>

        <div className="mt-6 flex justify-end gap-3">
          {(type === 'confirm' || type === 'error') && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={type === 'confirm' ? onConfirm : onClose}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${getButtonColor()}`}
          >
            {type === 'confirm' ? confirmText : type === 'success' ? 'Aceptar' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
