"use client";

import React from 'react';
import '../styles.css';

const PartnerForm: React.FC = () => {
  return (
    <form action="/referal/send" method="POST">
      {/* Extract form from referal.txt */}
      <div className="row ctr gp gp--xs">
        <input type="text" name="email" placeholder="Email" />
        <button type="submit">Отправить</button>
      </div>
      {/* Add more fields as per original HTML */}
    </form>
  );
};

export default PartnerForm;