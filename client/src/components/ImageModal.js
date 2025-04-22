import React, { useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';

const ImageModal = ({ show, handleClose, imageUrl }) => {
    useEffect(() => {
        // При монтировании компонента
        if (show) {
            document.body.style.overflow = 'hidden';
        }

        // При размонтировании компонента
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [show]);

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Body style={{ padding: 0 }}>
                <img src={imageUrl} alt="Product" style={{ width: '100%' }} />
                <Button
                    variant="secondary"
                    onClick={handleClose}
                    style={{ position: 'absolute', top: 10, right: 10 }}
                >
                    ×
                </Button>
            </Modal.Body>
        </Modal>
    );
};

export default ImageModal;